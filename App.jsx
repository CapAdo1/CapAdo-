import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { loadStripe } from "@stripe/stripe-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON;
const STRIPE_KEY = import.meta.env.VITE_STRIPE_KEY;
const PRICE_PREMIUM = import.meta.env.VITE_PRICE_PREMIUM;
const PRICE_PREMIUM_PLUS = import.meta.env.VITE_PRICE_PREMIUM_PLUS;
const FREE_LIMIT = 3;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const SYSTEM_PROMPT = `Tu es Cap Ado, un conseiller bienveillant et direct qui répond aux parents d'adolescents sur un forum communautaire francophone. 

TON STYLE EST NON-NÉGOCIABLE :
- Réponds en UN SEUL paragraphe fluide, sans bullet points, sans titres, sans listes
- Ton direct mais chaleureux, adulte à adulte, jamais condescendant
- Normalise le comportement adolescent AVANT de rediriger
- Nomme ce qui manque dans la dynamique parentale sans culpabiliser
- Renvoie la responsabilité au parent avec bienveillance
- Pose UNE question réflexive si pertinent
- Démystifie les solutions de fuite (internat, punitions excessives)
- Quand l'ado travaille et approche la majorité, oriente vers l'autonomie financière plutôt que la confrontation
- Termine TOUJOURS par "Bon courage." sur une ligne séparée
- Jamais de bullet points, jamais de gras, jamais de headers
- Longueur : 4 à 8 phrases maximum
- Si la personne mentionne des idées noires ou automutilation, priorise sa sécurité et mentionne le 3114`;

const SCREEN = { LANDING: "landing", AUTH: "auth", CHAT: "chat", PREMIUM: "premium" };

export default function CapAdo() {
  const [screen, setScreen] = useState(SCREEN.LANDING);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadProfile(session.user);
      else { setUser(null); setProfile(null); setScreen(SCREEN.LANDING); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (u) => {
    setUser(u);
    let { data } = await supabase.from("profiles").select("*").eq("id", u.id).single();
    if (!data) {
      const { data: newProfile } = await supabase.from("profiles").insert({
        id: u.id, name: u.user_metadata?.name || u.email?.split("@")[0], email: u.email, plan: "free"
      }).select().single();
      data = newProfile;
    }
    setProfile(data);
    setScreen(SCREEN.CHAT);
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setScreen(SCREEN.LANDING);
  };

  const updatePlan = (plan) => {
    setProfile(p => ({ ...p, plan }));
    supabase.from("profiles").update({ plan }).eq("id", user.id);
  };

  if (loading) return (
    <div style={{ ...s.root, alignItems: "center", justifyContent: "center" }}>
      <style>{css}</style>
      <div style={s.landingLogo}>CA</div>
      <p style={{ marginTop: 16, color: "#9a8f82", fontFamily: "system-ui", fontSize: 14 }}>Chargement…</p>
    </div>
  );

  return (
    <div style={s.root}>
      <style>{css}</style>
      {screen === SCREEN.LANDING && <Landing onAuth={() => setScreen(SCREEN.AUTH)} />}
      {screen === SCREEN.AUTH && <Auth onBack={() => setScreen(SCREEN.LANDING)} />}
      {screen === SCREEN.CHAT && <Chat user={user} profile={profile} onLogout={logout} onUpgrade={() => setScreen(SCREEN.PREMIUM)} />}
      {screen === SCREEN.PREMIUM && <Premium profile={profile} onBack={() => setScreen(SCREEN.CHAT)} onUpgrade={updatePlan} />}
    </div>
  );
}

function Landing({ onAuth }) {
  return (
    <div style={s.landing}>
      <div style={s.landingInner}>
        <div style={s.landingLogo}>CA</div>
        <h1 style={s.landingTitle}>Cap Ado</h1>
        <p style={s.landingTagline}>Conseils parentalité · Adolescence</p>
        <p style={s.landingDesc}>Vous traversez une période difficile avec votre adolescent ?<br />Des réponses franches, bienveillantes, sans jugement.</p>
        <div style={s.featureList}>
          {["Réponses personnalisées à votre situation", "Disponible 24h/24, 7j/7", "Approche directe et sans condescendance"].map(f => (
            <div key={f} style={s.featureItem}><span style={s.featureDot}>✦</span><span>{f}</span></div>
          ))}
        </div>
        <button style={s.ctaBtn} className="cta-btn" onClick={onAuth}>Commencer — c'est gratuit</button>
        <p style={s.landingNote}>3 questions offertes par jour · Sans carte bancaire</p>
      </div>
    </div>
  );
}

function Auth({ onBack }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(""); setInfo("");
    if (!email || !pass) { setError("Veuillez remplir tous les champs."); return; }
    if (mode === "register" && !name) { setError("Veuillez entrer votre prénom."); return; }
    setBusy(true);
    if (mode === "register") {
      const { error: e } = await supabase.auth.signUp({ email, password: pass, options: { data: { name } } });
      if (e) setError(e.message);
      else setInfo("Un email de confirmation vous a été envoyé. Vérifiez votre boîte mail.");
    } else {
      const { error: e } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (e) setError("Email ou mot de passe incorrect.");
    }
    setBusy(false);
  };

  return (
    <div style={s.authWrap}>
      <div style={s.authCard}>
        <button style={s.backBtn} onClick={onBack}>← Retour</button>
        <div style={s.authLogo}>CA</div>
        <h2 style={s.authTitle}>{mode === "login" ? "Bon retour" : "Créer un compte"}</h2>
        <p style={s.authSub}>{mode === "login" ? "Connectez-vous à votre espace Cap Ado" : "Rejoignez la communauté Cap Ado"}</p>
        {error && <div style={s.errorBox}>{error}</div>}
        {info && <div style={s.infoBox}>{info}</div>}
        {mode === "register" && <input style={s.input} className="ca-input" placeholder="Votre prénom" value={name} onChange={e => setName(e.target.value)} />}
        <input style={s.input} className="ca-input" placeholder="Adresse email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={s.input} className="ca-input" placeholder="Mot de passe" type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
        <button style={{ ...s.submitBtn, opacity: busy ? 0.7 : 1 }} className="cta-btn" onClick={submit} disabled={busy}>
          {busy ? "…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
        <p style={s.switchMode}>
          {mode === "login" ? "Pas encore de compte ? " : "Déjà un compte ? "}
          <span style={s.switchLink} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setInfo(""); }}>
            {mode === "login" ? "S'inscrire" : "Se connecter"}
          </span>
        </p>
      </div>
    </div>
  );
}

function Chat({ user, profile, onLogout, onUpgrade }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [used, setUsed] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const isFree = profile?.plan === "free";
  const remaining = Math.max(0, FREE_LIMIT - used);
  const blocked = isFree && remaining === 0;

  useEffect(() => {
    if (!user) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    supabase.from("questions").select("id", { count: "exact" })
      .eq("user_id", user.id).gte("asked_at", since)
      .then(({ count }) => setUsed(count || 0));
  }, [user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const handleInput = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || blocked) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);
    if (isFree) {
      await supabase.from("questions").insert({ user_id: user.id });
      setUsed(u => u + 1);
    }
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: SYSTEM_PROMPT, messages: newMessages }),
      });
      const data = await response.json();
      const reply = data.content?.map(b => b.text || "").join("") || "Une erreur est survenue.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Une erreur est survenue. Veuillez réessayer." }]);
    }
    setLoading(false);
  };

  const planLabel = { free: "Gratuit", premium: "Premium", premium_plus: "Premium+" }[profile?.plan] || "Gratuit";
  const planColor = { free: "#9a8f82", premium: "#c8602a", premium_plus: "#7c3aed" }[profile?.plan] || "#9a8f82";

  return (
    <div style={s.chatRoot}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logoIcon}>CA</div>
          <div>
            <div style={s.logoTitle}>Cap Ado</div>
            {isFree && <div style={s.quotaBar}>{remaining > 0 ? `${remaining} question${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""} (24h)` : "Quota atteint"}</div>}
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <button style={s.avatarBtn} onClick={() => setMenuOpen(!menuOpen)}>
            <div style={s.avatarCircle}>{profile?.name?.[0]?.toUpperCase() || "?"}</div>
          </button>
          {menuOpen && (
            <div style={s.menu}>
              <div style={s.menuHeader}>
                <div style={s.menuName}>{profile?.name}</div>
                <div style={{ ...s.menuPlan, color: planColor }}>{planLabel}</div>
              </div>
              {profile?.plan === "free" && (
                <button style={s.menuItem} className="menu-item upgrade" onClick={() => { setMenuOpen(false); onUpgrade(); }}>✦ Passer Premium</button>
              )}
              <button style={s.menuItem} className="menu-item" onClick={() => { setMenuOpen(false); onLogout(); }}>Se déconnecter</button>
            </div>
          )}
        </div>
      </div>

      <div style={s.feed} onClick={() => setMenuOpen(false)}>
        {messages.length === 0 && (
          <div style={s.welcome}>
            <div style={s.welcomeIcon}>💬</div>
            <div style={s.welcomeTitle}>Bonjour {profile?.name},</div>
            <div style={s.welcomeText}>Posez votre question, je vous réponds avec franchise et bienveillance.</div>
            <div style={s.exampleRow}>
              {["Mon fils de 15 ans refuse d'aller en cours.", "Ma fille est accro à son téléphone.", "Comment poser des limites sans tout bloquer ?"].map(ex => (
                <button key={ex} style={s.exampleBtn} className="example-btn" onClick={() => { setInput(ex); textareaRef.current?.focus(); }}>{ex}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ ...s.msgRow, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && <div style={s.avatar}>CA</div>}
            <div style={m.role === "user" ? s.bubbleUser : s.bubbleAssistant}>
              {m.content.split("\n").map((line, j, arr) => <span key={j}>{line}{j < arr.length - 1 && <br />}</span>)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
            <div style={s.avatar}>CA</div>
            <div style={s.bubbleAssistant}><span style={s.dots}><span className="dot" /><span className="dot" /><span className="dot" /></span></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {blocked && (
        <div style={s.blockedBanner}>
          <div style={s.blockedText}>Vous avez utilisé vos 3 questions gratuites des dernières 24h.</div>
          <button style={s.blockedBtn} className="cta-btn" onClick={onUpgrade}>Passer Premium — illimité</button>
        </div>
      )}

      {!blocked && (
        <div style={s.inputArea}>
          <div style={s.inputBox}>
            <textarea ref={textareaRef} value={input} onChange={handleInput}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Décrivez votre situation…" style={s.textarea} rows={1} />
            <button onClick={sendMessage} disabled={!input.trim() || loading} style={s.sendBtn} className="send-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div style={s.hint}>Entrée pour envoyer · Shift+Entrée pour saut de ligne</div>
        </div>
      )}
    </div>
  );
}

function Premium({ profile, onBack, onUpgrade }) {
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    if (plan) { onUpgrade(plan); window.history.replaceState({}, "", window.location.pathname); onBack(); }
  }, []);

  const handleStripe = async (priceId, planId) => {
    setBusy(planId);
    try {
      const stripe = await loadStripe(STRIPE_KEY);
      await stripe.redirectToCheckout({
        lineItems: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        successUrl: window.location.origin + "?plan=" + planId,
        cancelUrl: window.location.origin,
        customerEmail: profile?.email,
      });
    } catch {
      alert("Erreur lors de la redirection vers le paiement. Réessayez.");
    }
    setBusy(null);
  };

  const plans = [
    { id: "free", name: "Gratuit", price: "0€", period: "", color: "#9a8f82", features: ["3 questions par jour", "Accès à la communauté en lecture"], disabled: true },
    { id: "premium", name: "Premium", price: "7,99€", period: "/ mois", color: "#c8602a", priceId: PRICE_PREMIUM, features: ["Questions illimitées", "Accès complet à la communauté", "Contenus exclusifs & cas pratiques", "Historique de vos conversations"], highlight: true },
    { id: "premium_plus", name: "Premium+", price: "39€", period: "/ mois", color: "#7c3aed", priceId: PRICE_PREMIUM_PLUS, features: ["Tout Premium inclus", "WhatsApp direct avec Titouan", "Accompagnement personnalisé", "Réponse sous 24h garantie"] },
  ];

  return (
    <div style={s.premiumWrap}>
      <div style={s.premiumInner}>
        <button style={s.backBtn} onClick={onBack}>← Retour</button>
        <div style={s.premiumHeader}>
          <h2 style={s.premiumTitle}>Choisissez votre formule</h2>
          <p style={s.premiumSub}>Accédez à un accompagnement sans limite, adapté à votre situation.</p>
        </div>
        <div style={s.plansRow}>
          {plans.map(plan => (
            <div key={plan.id} style={{ ...s.planCard, borderColor: plan.highlight ? plan.color : "#e0d9cf", boxShadow: plan.highlight ? `0 4px 24px ${plan.color}22` : "0 2px 8px rgba(0,0,0,0.06)" }}>
              {plan.highlight && <div style={{ ...s.planBadge, background: plan.color }}>Recommandé</div>}
              <div style={{ ...s.planName, color: plan.color }}>{plan.name}</div>
              <div style={s.planPrice}><span style={s.planAmount}>{plan.price}</span><span style={s.planPeriod}>{plan.period}</span></div>
              <div style={s.planFeatures}>
                {plan.features.map(f => (
                  <div key={f} style={s.planFeature}><span style={{ ...s.planCheck, color: plan.color }}>✓</span><span>{f}</span></div>
                ))}
              </div>
              <button
                style={{ ...s.planBtn, background: plan.disabled || profile?.plan === plan.id ? "#f0ece6" : plan.color, color: plan.disabled || profile?.plan === plan.id ? "#9a8f82" : "#fff", cursor: plan.disabled || profile?.plan === plan.id ? "default" : "pointer", opacity: busy === plan.id ? 0.7 : 1 }}
                className={plan.disabled || profile?.plan === plan.id ? "" : "plan-btn"}
                disabled={plan.disabled || profile?.plan === plan.id || busy === plan.id}
                onClick={() => plan.priceId && handleStripe(plan.priceId, plan.id)}
              >
                {busy === plan.id ? "Redirection…" : profile?.plan === plan.id ? "Votre offre actuelle" : plan.id === "free" ? "Offre gratuite" : `Choisir ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
        <p style={s.premiumNote}>Paiement sécurisé · Résiliation à tout moment · Sans engagement</p>
      </div>
    </div>
  );
}

const s = {
  root: { height: "100vh", fontFamily: "'Georgia', serif", color: "#2c2a27", background: "#faf8f5", display: "flex", flexDirection: "column", maxWidth: 720, margin: "0 auto", position: "relative", overflow: "hidden" },
  landing: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflowY: "auto" },
  landingInner: { textAlign: "center", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 },
  landingLogo: { width: 72, height: 72, borderRadius: "50%", background: "#c8602a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: "bold", letterSpacing: 1 },
  landingTitle: { fontSize: 36, fontWeight: "bold", color: "#2c2a27", margin: 0 },
  landingTagline: { fontSize: 14, color: "#9a8f82", fontFamily: "system-ui, sans-serif", margin: 0 },
  landingDesc: { fontSize: 16, color: "#5a5048", lineHeight: 1.7, fontFamily: "system-ui, sans-serif" },
  featureList: { display: "flex", flexDirection: "column", gap: 8, width: "100%", textAlign: "left" },
  featureItem: { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: "#5a5048", fontFamily: "system-ui, sans-serif" },
  featureDot: { color: "#c8602a", flexShrink: 0, marginTop: 1 },
  ctaBtn: { background: "#c8602a", color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 16, fontWeight: "bold", cursor: "pointer", width: "100%", fontFamily: "system-ui, sans-serif", transition: "all 0.15s" },
  landingNote: { fontSize: 12, color: "#b0a89e", fontFamily: "system-ui, sans-serif", margin: 0 },
  authWrap: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflowY: "auto" },
  authCard: { background: "#fff", borderRadius: 20, padding: 32, width: "100%", maxWidth: 420, border: "1px solid #e8e3db", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", gap: 16 },
  backBtn: { background: "none", border: "none", color: "#9a8f82", cursor: "pointer", fontSize: 14, textAlign: "left", padding: 0, fontFamily: "system-ui, sans-serif" },
  authLogo: { width: 48, height: 48, borderRadius: "50%", background: "#c8602a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 16, letterSpacing: 1, alignSelf: "center" },
  authTitle: { fontSize: 22, fontWeight: "bold", textAlign: "center", margin: 0 },
  authSub: { fontSize: 14, color: "#9a8f82", textAlign: "center", fontFamily: "system-ui, sans-serif", margin: 0 },
  errorBox: { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626", fontFamily: "system-ui, sans-serif" },
  infoBox: { background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#16a34a", fontFamily: "system-ui, sans-serif" },
  input: { border: "1px solid #e0d9cf", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontFamily: "system-ui, sans-serif", color: "#2c2a27", outline: "none", background: "#faf8f5" },
  submitBtn: { background: "#c8602a", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: "bold", cursor: "pointer", fontFamily: "system-ui, sans-serif", transition: "all 0.15s" },
  switchMode: { fontSize: 13, color: "#9a8f82", textAlign: "center", fontFamily: "system-ui, sans-serif", margin: 0 },
  switchLink: { color: "#c8602a", cursor: "pointer", fontWeight: "bold" },
  chatRoot: { display: "flex", flexDirection: "column", height: "100vh", background: "#faf8f5" },
  header: { padding: "12px 20px", borderBottom: "1px solid #e8e3db", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logoIcon: { width: 38, height: 38, borderRadius: "50%", background: "#c8602a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 13, letterSpacing: 1, flexShrink: 0 },
  logoTitle: { fontSize: 16, fontWeight: "bold", color: "#2c2a27" },
  quotaBar: { fontSize: 11, color: "#9a8f82", fontFamily: "system-ui, sans-serif", marginTop: 1 },
  avatarBtn: { background: "none", border: "none", cursor: "pointer", padding: 0 },
  avatarCircle: { width: 36, height: 36, borderRadius: "50%", background: "#f0ece6", color: "#c8602a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 15, fontFamily: "system-ui, sans-serif", border: "2px solid #e0d9cf" },
  menu: { position: "absolute", right: 0, top: 44, background: "#fff", border: "1px solid #e0d9cf", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", minWidth: 200, overflow: "hidden", zIndex: 100 },
  menuHeader: { padding: "14px 16px", borderBottom: "1px solid #f0ece6" },
  menuName: { fontSize: 14, fontWeight: "bold", color: "#2c2a27", fontFamily: "system-ui, sans-serif" },
  menuPlan: { fontSize: 12, marginTop: 2, fontFamily: "system-ui, sans-serif" },
  menuItem: { display: "block", width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", fontSize: 14, cursor: "pointer", fontFamily: "system-ui, sans-serif", color: "#2c2a27" },
  feed: { flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 },
  welcome: { textAlign: "center", padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  welcomeIcon: { fontSize: 36 },
  welcomeTitle: { fontSize: 20, fontWeight: "bold", color: "#2c2a27" },
  welcomeText: { fontSize: 15, color: "#6b6155", maxWidth: 400, lineHeight: 1.6, fontFamily: "system-ui, sans-serif" },
  exampleRow: { display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 440 },
  exampleBtn: { background: "#fff", border: "1px solid #e0d9cf", borderRadius: 10, padding: "10px 16px", fontSize: 13, color: "#5a5048", cursor: "pointer", textAlign: "left", fontFamily: "system-ui, sans-serif", lineHeight: 1.4 },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 10 },
  avatar: { width: 30, height: 30, borderRadius: "50%", background: "#c8602a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: "bold", flexShrink: 0, letterSpacing: 0.5 },
  bubbleUser: { background: "#c8602a", color: "#fff", borderRadius: "18px 18px 4px 18px", padding: "12px 16px", maxWidth: "75%", fontSize: 14, lineHeight: 1.65, fontFamily: "system-ui, sans-serif" },
  bubbleAssistant: { background: "#fff", color: "#2c2a27", borderRadius: "18px 18px 18px 4px", padding: "14px 18px", maxWidth: "80%", fontSize: 15, lineHeight: 1.8, border: "1px solid #ede7df", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  dots: { display: "flex", gap: 5, alignItems: "center", padding: "2px 0" },
  blockedBanner: { background: "#fff7f4", borderTop: "1px solid #f0d5c8", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" },
  blockedText: { fontSize: 14, color: "#5a5048", textAlign: "center", fontFamily: "system-ui, sans-serif" },
  blockedBtn: { background: "#c8602a", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: "bold", cursor: "pointer", fontFamily: "system-ui, sans-serif" },
  inputArea: { padding: "12px 16px 16px", borderTop: "1px solid #e8e3db", background: "#fff" },
  inputBox: { display: "flex", alignItems: "flex-end", gap: 10, background: "#f5f1eb", borderRadius: 16, padding: "8px 8px 8px 16px", border: "1px solid #e0d9cf" },
  textarea: { flex: 1, border: "none", background: "transparent", resize: "none", fontSize: 14, lineHeight: 1.6, color: "#2c2a27", outline: "none", fontFamily: "system-ui, sans-serif", maxHeight: 160, overflowY: "auto", padding: "4px 0" },
  sendBtn: { width: 38, height: 38, borderRadius: 10, background: "#c8602a", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" },
  hint: { fontSize: 11, color: "#b0a89e", textAlign: "center", marginTop: 6, fontFamily: "system-ui, sans-serif" },
  premiumWrap: { flex: 1, overflowY: "auto", padding: 24, background: "#faf8f5" },
  premiumInner: { maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 },
  premiumHeader: { textAlign: "center" },
  premiumTitle: { fontSize: 26, fontWeight: "bold", color: "#2c2a27", margin: "0 0 8px" },
  premiumSub: { fontSize: 15, color: "#6b6155", fontFamily: "system-ui, sans-serif", margin: 0 },
  plansRow: { display: "flex", flexDirection: "column", gap: 16 },
  planCard: { background: "#fff", border: "2px solid #e0d9cf", borderRadius: 16, padding: 24, position: "relative" },
  planBadge: { position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", color: "#fff", fontSize: 11, fontWeight: "bold", padding: "4px 12px", borderRadius: 20, fontFamily: "system-ui, sans-serif", whiteSpace: "nowrap" },
  planName: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  planPrice: { display: "flex", alignItems: "baseline", gap: 4, marginBottom: 16 },
  planAmount: { fontSize: 32, fontWeight: "bold", color: "#2c2a27" },
  planPeriod: { fontSize: 14, color: "#9a8f82", fontFamily: "system-ui, sans-serif" },
  planFeatures: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 },
  planFeature: { display: "flex", gap: 10, fontSize: 14, color: "#5a5048", fontFamily: "system-ui, sans-serif" },
  planCheck: { fontWeight: "bold", flexShrink: 0 },
  planBtn: { width: "100%", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: "bold", fontFamily: "system-ui, sans-serif", transition: "all 0.15s" },
  premiumNote: { fontSize: 12, color: "#b0a89e", textAlign: "center", fontFamily: "system-ui, sans-serif" },
};

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .cta-btn:hover:not(:disabled) { background: #a84e22 !important; transform: translateY(-1px); }
  .example-btn:hover { background: #f5f1eb !important; border-color: #c8602a !important; color: #c8602a !important; }
  .send-btn:hover:not(:disabled) { background: #a84e22 !important; transform: scale(1.05); }
  .send-btn:disabled { background: #d4c9be !important; cursor: not-allowed !important; }
  .menu-item:hover { background: #faf8f5 !important; }
  .menu-item.upgrade { color: #c8602a !important; font-weight: bold; }
  .plan-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .ca-input:focus { border-color: #c8602a !important; background: #fff !important; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #c8602a; display: inline-block; animation: pulse 1.2s infinite ease-in-out; }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse { 0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: #d4c9be; border-radius: 4px; }
`;
