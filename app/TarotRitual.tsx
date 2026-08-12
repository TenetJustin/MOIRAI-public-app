"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SpreadKey, Suit, TarotCardData, spreads, tarotDeck } from "./deck";
import { clearLocalMoiraiData, createBackup, MOIRAI_STORAGE_KEYS, parseBackup, ReadingRecord, readRecords, restoreBackup } from "./localData";
import { CardOrientation, createLocalOracleReading, randomOrientation, secureRandomUnit, shuffleDeckSecure } from "./oracleInterpretation";
import { tarotStories } from "./stories";

type Step = "landing" | "intention" | "spread" | "purify" | "shuffle" | "cut" | "draw" | "reading" | "archive" | "library";
type LibrarySuit = "all" | Suit;
type DrawnCard = { card: TarotCardData; orientation: CardOrientation };
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const ritualSteps: { key: Step; label: string }[] = [
  { key: "intention", label: "意图" }, { key: "spread", label: "牌阵" },
  { key: "purify", label: "净化" }, { key: "shuffle", label: "洗牌" },
  { key: "cut", label: "切牌" }, { key: "draw", label: "抽牌" },
  { key: "reading", label: "神谕" },
];

const libraryFilters: { key: LibrarySuit; label: string }[] = [
  { key: "all", label: "全部 78 张" }, { key: "major", label: "大阿卡纳" },
  { key: "wands", label: "权杖" }, { key: "cups", label: "圣杯" },
  { key: "swords", label: "宝剑" }, { key: "pentacles", label: "星币" },
];

function ThreeTable({ active }: { active: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, -7.4, 7.2);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    mount.appendChild(renderer.domElement);

    const table = new THREE.Mesh(
      new THREE.CircleGeometry(4.15, 80),
      new THREE.MeshBasicMaterial({ color: 0x151414, transparent: true, opacity: 0.76 })
    );
    table.rotation.x = -Math.PI / 2;
    scene.add(table);

    const rings = new THREE.Group();
    [2.4, 3.1, 3.75].forEach((radius, index) => {
      const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2);
      const points = curve.getPoints(120).map((p) => new THREE.Vector3(p.x, 0.025 + index * 0.006, p.y));
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: index === 1 ? 0xef4050 : 0xf2c43d, transparent: true, opacity: 0.24 })
      );
      line.rotation.x = Math.PI / 2;
      rings.add(line);
    });
    scene.add(rings);

    const cardGroup = new THREE.Group();
    const cardGeo = new THREE.PlaneGeometry(0.42, 0.64);
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      const material = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xf2eee6 : 0x263f89, side: THREE.DoubleSide });
      const card = new THREE.Mesh(cardGeo, material);
      card.position.set(Math.cos(a) * 3.48, Math.sin(a) * 3.48, 0.08);
      card.rotation.z = a + Math.PI / 2;
      card.userData.phase = a;
      cardGroup.add(card);
    }
    cardGroup.rotation.x = -Math.PI / 2;
    scene.add(cardGroup);

    const starPoints: THREE.Vector3[] = [];
    for (let i = 0; i < 90; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = 4.4 + Math.random() * 4.5;
      starPoints.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, Math.random() * 1.8 - 0.2));
    }
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(starPoints),
      new THREE.PointsMaterial({ color: 0xf2c43d, size: 0.035, transparent: true, opacity: 0.55 })
    );
    stars.rotation.x = -Math.PI / 2;
    scene.add(stars);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    let frame = 0;
    const animate = (time: number) => {
      rings.rotation.z = time * 0.000025;
      cardGroup.rotation.z += active ? 0.00115 : 0.00018;
      cardGroup.children.forEach((child, index) => {
        child.position.z = 0.08 + Math.sin(time * 0.0012 + index) * (active ? 0.045 : 0.015);
      });
      stars.rotation.z -= 0.00012;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.dispose();
      cardGeo.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [active]);
  return <div className="three-table" ref={mountRef} aria-hidden="true" />;
}

function useOracleAudio() {
  const contextRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const [enabled, setEnabled] = useState(false);

  const stop = useCallback(() => {
    nodesRef.current.forEach((node) => {
      try { (node as OscillatorNode).stop?.(); } catch { /* already stopped */ }
      try { node.disconnect(); } catch { /* disconnected */ }
    });
    nodesRef.current = [];
    contextRef.current?.close();
    contextRef.current = null;
    setEnabled(false);
  }, []);

  const toggle = useCallback(() => {
    if (enabled) { stop(); return; }
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const master = context.createGain();
    master.gain.value = 0.032;
    master.connect(context.destination);
    [73.42, 110, 146.83].forEach((frequency, index) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = index === 0 ? "sine" : "triangle";
      osc.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.8 : 0.22;
      osc.connect(gain).connect(master);
      osc.start();
      nodesRef.current.push(osc, gain);
    });
    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.12;
    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = noiseBuffer; noise.loop = true; filter.type = "lowpass"; filter.frequency.value = 420; noiseGain.gain.value = 0.22;
    noise.connect(filter).connect(noiseGain).connect(master); noise.start();
    nodesRef.current.push(noise, filter, noiseGain, master);
    contextRef.current = context;
    setEnabled(true);
  }, [enabled, stop]);

  const chime = useCallback(() => {
    const context = contextRef.current;
    if (!context) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(523.25, context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(783.99, context.currentTime + 0.7);
    gain.gain.setValueAtTime(0.08, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.4);
    osc.connect(gain).connect(context.destination); osc.start(); osc.stop(context.currentTime + 1.5);
  }, []);

  useEffect(() => stop, [stop]);
  return { enabled, toggle, chime };
}

function CommonBack({ compact = false }: { compact?: boolean }) {
  return <div className={`common-back ${compact ? "compact" : ""}`}>
    <img src="./cards/ritual-back.webp" alt="" draggable={false} />
  </div>;
}

function PantheonBackdrop() {
  return <div className="pantheon-backdrop" aria-hidden="true">
    <div className="mythic-panorama">
      <img src="./landing/mythic-panorama.png" alt="" draggable={false} />
    </div>
    <div className="pantheon-row pantheon-row-single">
      {[...tarotDeck, ...tarotDeck].map((card, index) => <figure className={`pantheon-portrait suit-${card.suit}`} key={`row-${card.id}-${index}`}>
        <img src={`./cards/fronts/${card.id}.webp`} alt="" draggable={false} onError={(event) => event.currentTarget.parentElement?.classList.add("portrait-missing")} />
        <figcaption>{card.myth}</figcaption>
      </figure>)}
    </div>
  </div>;
}

function CardFace({ card, orientation = "upright" }: { card: TarotCardData; orientation?: CardOrientation }) {
  const pipCount = card.pipCount ?? 0;
  const [customArtAvailable, setCustomArtAvailable] = useState(true);
  return <div className={`card-side card-front suit-${card.suit} orientation-${orientation}`}>
    {customArtAvailable && <img className="complete-card-art" src={`./cards/fronts/${card.id}.webp`} alt={`${card.nameZh}：${card.myth}`} draggable={false} onError={() => setCustomArtAvailable(false)} />}
    <div className="card-number">{card.numeral}</div>
    <div className="art-field">
      <div className="halo-lines" /><div className="color-ribbon ribbon-a" /><div className="color-ribbon ribbon-b" />
      <div className="card-sigil">{card.sigil}</div>
      {pipCount > 0 && <div className={`pip-field pips-${Math.min(pipCount, 10)}`}>{Array.from({ length: pipCount }, (_, i) => <i key={i}>{card.sigil}</i>)}</div>}
      <div className="ground-glyph">⌁ ⌁ ⌁</div>
    </div>
    <div className="card-label"><strong>{card.nameEn}</strong><span>{card.nameZh}</span><small>{card.myth}</small></div>
  </div>;
}

function CardReadingBack({ card }: { card: TarotCardData }) {
  return <div className={`card-side card-reading suit-${card.suit}`}>
    <img className="complete-card-art card-back-art" src={`./cards/backs/${card.id}.webp`} alt={`${card.nameZh}的文字解释背面`} draggable={false} />
  </div>;
}

function TarotCard({ card, orientation, position, className = "" }: { card: TarotCardData; orientation: CardOrientation; position?: string; className?: string }) {
  const [flipped, setFlipped] = useState(false);
  return <div className={`reading-card-wrap ${className}`}>
    {position && <div className="position-label">{position} · {orientation === "upright" ? "正位" : "逆位"}</div>}
    <motion.button
      className="tarot-card"
      onClick={() => setFlipped((value) => !value)}
      aria-label={`${card.nameZh}${orientation === "upright" ? "正位" : "逆位"}，点击${flipped ? "查看牌面" : "旋转查看解读"}`}
      type="button"
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          className="card-flip-layer"
          key={flipped ? `back-${card.id}` : `front-${card.id}`}
          initial={{ rotateY: flipped ? 90 : -90, opacity: .25 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: flipped ? -90 : 90, opacity: .25 }}
          transition={{ duration: .32, ease: [0.4, 0, 0.2, 1] }}
        >
          {flipped ? <CardReadingBack card={card} /> : <CardFace card={card} orientation={orientation} />}
        </motion.div>
      </AnimatePresence>
    </motion.button>
    <button className="flip-hint" onClick={() => setFlipped((value) => !value)} type="button">{flipped ? "返回牌面" : "旋转解读"} ↻</button>
  </div>;
}

function StepShell({ eyebrow, title, children, onBack }: { eyebrow: string; title: string; children: React.ReactNode; onBack?: () => void }) {
  return <motion.section className="ritual-panel" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
    {onBack && <button className="back-link" onClick={onBack} type="button">← 返回</button>}
    <p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{children}
  </motion.section>;
}

export default function TarotRitual() {
  const [step, setStep] = useState<Step>("landing");
  const [question, setQuestion] = useState("");
  const [spread, setSpread] = useState<SpreadKey>("single");
  const [purified, setPurified] = useState(false);
  const [shuffleCount, setShuffleCount] = useState(0);
  const [deck, setDeck] = useState(() => shuffleDeckSecure(tarotDeck));
  const [remaining, setRemaining] = useState<TarotCardData[]>([]);
  const [drawn, setDrawn] = useState<DrawnCard[]>([]);
  const [cutPile, setCutPile] = useState<number | null>(null);
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [saved, setSaved] = useState(false);
  const [librarySuit, setLibrarySuit] = useState<LibrarySuit>("all");
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [archiveMessage, setArchiveMessage] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [appInstalled, setAppInstalled] = useState(false);
  const { enabled: audioEnabled, toggle: toggleAudio, chime } = useOracleAudio();

  useEffect(() => {
    const restoreRecords = window.setTimeout(() => {
      setRecords(readRecords());
    }, 0);
    return () => window.clearTimeout(restoreRecords);
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setAppInstalled(standalone);
    const capturePrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    const markInstalled = () => { setAppInstalled(true); setInstallPrompt(null); setInstallHelpOpen(false); };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  useEffect(() => {
    if (selectedStoryIndex === null) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedStoryIndex(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedStoryIndex]);

  const persist = (next: ReadingRecord[]) => {
    setRecords(next);
    localStorage.setItem(MOIRAI_STORAGE_KEYS.records, JSON.stringify(next));
  };

  const exportLocalData = () => {
    const blob = new Blob([JSON.stringify(createBackup(records), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `moirai-local-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setArchiveMessage("本地数据备份已导出。请将文件保存到安全的位置。");
  };

  const importLocalData = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      restoreBackup(backup);
      setRecords(backup.data.records);
      setArchiveMessage(`已恢复 ${backup.data.records.length} 条命运档案；收藏与设置也已恢复。`);
      setConfirmClear(false);
    } catch (error) {
      setArchiveMessage(error instanceof Error ? `导入失败：${error.message}` : "导入失败：无法读取备份文件");
    }
  };

  const clearAllLocalData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setArchiveMessage("再次点击“确认清除”将删除这台设备中的档案、收藏与设置。此操作无法撤销。");
      return;
    }
    clearLocalMoiraiData();
    setRecords([]);
    setConfirmClear(false);
    setArchiveMessage("这台设备中的 MOIRAI 本地数据已清除。");
  };

  const installApp = async () => {
    if (!installPrompt) { setInstallHelpOpen(true); return; }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setAppInstalled(true);
    setInstallPrompt(null);
  };

  const go = (next: Step) => { setSelectedStoryIndex(null); setStep(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const resetRitualState = () => {
    setQuestion(""); setSpread("single"); setPurified(false); setShuffleCount(0); setDeck(shuffleDeckSecure(tarotDeck));
    setRemaining([]); setDrawn([]); setCutPile(null); setSaved(false);
  };
  const startNewRitual = () => { resetRitualState(); go("intention"); };
  const returnToTemple = () => { resetRitualState(); go("landing"); };
  const shuffle = () => { setDeck(shuffleDeckSecure(deck)); setShuffleCount((v) => v + 1); chime(); };
  const chooseCut = (pile: number) => {
    const size = Math.floor(deck.length / 3);
    const piles = [deck.slice(0, size), deck.slice(size, size * 2), deck.slice(size * 2)];
    const order = pile === 0 ? [1, 2, 0] : pile === 1 ? [2, 0, 1] : [0, 1, 2];
    const reordered = order.flatMap((index) => piles[index]);
    setDeck(reordered); setRemaining(reordered); setCutPile(pile); chime();
    window.setTimeout(() => go("draw"), 560);
  };
  const drawCard = () => {
    if (drawn.length >= spreads[spread].count || remaining.length === 0) return;
    const index = Math.floor(secureRandomUnit() * remaining.length);
    const selected: DrawnCard = { card: remaining[index], orientation: randomOrientation() };
    const nextDrawn = [...drawn, selected];
    setDrawn(nextDrawn); setRemaining(remaining.filter((_, i) => i !== index)); chime();
    if (nextDrawn.length === spreads[spread].count) window.setTimeout(() => go("reading"), 720);
  };
  const saveReading = () => {
    if (saved) return;
    const record: ReadingRecord = {
      id: `${Date.now()}`, createdAt: new Date().toISOString(), question: question.trim() || "未写下的问题",
      spread, cards: drawn.map(({ card, orientation }, index) => ({ id: card.id, position: spreads[spread].positions[index], orientation })),
    };
    persist([record, ...records]); setSaved(true); chime();
  };
  const currentIndex = ritualSteps.findIndex((item) => item.key === step);
  const chosenSpread = spreads[spread];
  const oracleCards = useMemo(() => drawn.map(({ card, orientation }, index) => ({ card, orientation, position: chosenSpread.positions[index] })), [drawn, chosenSpread.positions]);
  const localOracleReading = useMemo(() => createLocalOracleReading(question, spread, oracleCards), [question, spread, oracleCards]);
  const archiveCards = useCallback((record: ReadingRecord) => record.cards.map((item) => ({ ...item, card: tarotDeck.find((card) => card.id === item.id)! })), []);
  const libraryCards = useMemo(() => tarotDeck.map((card, index) => ({ card, index })).filter(({ card }) => librarySuit === "all" || card.suit === librarySuit), [librarySuit]);

  return <main className={`oracle-app step-${step}`}>
    <ThreeTable active={["shuffle", "cut", "draw"].includes(step)} />
    <div className="paper-grain" />
    <header className="site-header">
      <button className="brand" onClick={returnToTemple} type="button"><span>✦</span><div><b>MOIRAI</b><small>ORACLE OF OLYMPUS · 奥林匹斯神谕</small></div></button>
      <div className="header-actions">
        <button onClick={toggleAudio} className={audioEnabled ? "active" : ""} type="button" aria-label="切换环境音">{audioEnabled ? "声场开启" : "开启声场"}</button>
        <button onClick={() => go("library")} type="button">神话图鉴</button>
        <button onClick={() => go("archive")} type="button">命运档案 <span>{records.length}</span></button>
      </div>
    </header>

    {step !== "landing" && step !== "archive" && <nav className="ritual-progress" aria-label="仪式进度">
      {ritualSteps.map((item, index) => <div key={item.key} className={index < currentIndex ? "done" : index === currentIndex ? "current" : ""}><i>{index < currentIndex ? "✓" : index + 1}</i><span>{item.label}</span></div>)}
    </nav>}

    <AnimatePresence mode="wait">
      {step === "landing" && <motion.section key="landing" className="landing destiny-landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <PantheonBackdrop />
        <div className="pantheon-veil" />
        <motion.div className="moirai-altar" initial={{ opacity: 0, y: 22, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .8, ease: "easeOut" }}>
          <div className="moirai-kicker"><span>ΜΟΙΡΑΙ</span><i>命运三女神</i><span>THE FATES</span></div>
          <div className="moirai-frame">
            <img className="moirai-art" src="./landing/moirai-figures.png" alt="命运三女神纺织、丈量并剪断命运之线，环绕命运之轮" draggable={false} />
          </div>
          <div className="moirai-actions">
            <p>在纺线、丈量与剪断之间，向神谕留下你的问题</p>
            <div>
              <button className="moirai-primary" onClick={startNewRitual} type="button">开始仪式 <span>→</span></button>
              <button className="moirai-secondary" onClick={() => go("archive")} type="button">打开命运档案 <span>{records.length}</span></button>
              <button className="moirai-story" onClick={() => go("library")} type="button">查看 78 张塔罗牌的希腊故事 <span>↗</span></button>
              <button className="moirai-install" onClick={() => void installApp()} disabled={appInstalled} type="button">{appInstalled ? "✓ 已安装到桌面" : "安装到手机／电脑桌面"} <span>{appInstalled ? "" : "↓"}</span></button>
            </div>
          </div>
          <div className="moirai-local"><span>LOCAL ORACLE</span><b>不登录 · 不上传 · 不使用数据库</b><span>78 MYTHIC CARDS</span></div>
        </motion.div>
      </motion.section>}

      {step === "intention" && <StepShell key="intention" eyebrow="STEP 01 · SET AN INTENTION" title="把问题留在祭坛上" onBack={returnToTemple}>
        <p className="panel-intro">它不会被发送到任何地方。尽量询问你想理解的状态，而不是要求一个确定预言。</p>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={180} placeholder="例如：我此刻最需要看见的内在动力是什么？" autoFocus />
        <div className="input-meta"><span>仅保存在这台电脑</span><span>{question.length} / 180</span></div>
        <button className="primary wide" onClick={() => go("spread")} disabled={!question.trim()} type="button">封存意图 <span>→</span></button>
      </StepShell>}

      {step === "spread" && <StepShell key="spread" eyebrow="STEP 02 · CHOOSE A SPREAD" title="选择神谕展开的方式" onBack={() => go("intention")}>
        <div className="spread-grid">{(Object.keys(spreads) as SpreadKey[]).map((key) => { const item = spreads[key]; return <button key={key} className={`spread-option ${spread === key ? "selected" : ""}`} onClick={() => setSpread(key)} type="button"><div className={`spread-diagram diagram-${key}`}>{Array.from({ length: item.count }, (_, i) => <i key={i} />)}</div><strong>{item.name}</strong><span>{item.subtitle}</span><small>{item.count} 张牌</small></button>; })}</div>
        <button className="primary wide" onClick={() => go("purify")} type="button">进入净化空间 <span>→</span></button>
      </StepShell>}

      {step === "purify" && <StepShell key="purify" eyebrow="STEP 03 · PURIFY" title="让注意力回到此刻" onBack={() => go("spread")}>
        <div className={`candle-ritual ${purified ? "lit" : ""}`}><button onClick={() => { setPurified(true); chime(); }} type="button" aria-label="点燃圣火"><span className="flame" /><span className="wick" /><span className="candle" /></button><div className="breath-ring"><i /><i /><i /></div></div>
        <p className="breath-copy">{purified ? "吸气四拍 · 停留四拍 · 呼气六拍" : "点击圣火，开始一次缓慢呼吸"}</p>
        <button className="primary wide" disabled={!purified} onClick={() => go("shuffle")} type="button">我已准备好 <span>→</span></button>
      </StepShell>}

      {step === "shuffle" && <StepShell key="shuffle" eyebrow="STEP 04 · SHUFFLE" title="把意图交给牌组" onBack={() => go("purify")}>
        <div className={`shuffle-stage count-${Math.min(shuffleCount, 3)}`}><button className="deck-stack" onClick={shuffle} type="button" aria-label="点击洗牌">{[0,1,2,3,4].map((n) => <motion.div key={n} animate={shuffleCount ? { x: [0, (n-2)*38, 0], rotate: [0, (n-2)*4, 0] } : {}} transition={{ duration: .7 }}><CommonBack compact /></motion.div>)}</button></div>
        <p className="shuffle-copy">点击牌堆洗牌 · 已完成 <b>{shuffleCount}</b> 次</p>
        <button className="primary wide" disabled={shuffleCount < 1} onClick={() => go("cut")} type="button">停止洗牌 <span>→</span></button>
      </StepShell>}

      {step === "cut" && <StepShell key="cut" eyebrow="STEP 05 · CUT THE DECK" title="选择一叠，重新组合命运" onBack={() => go("shuffle")}>
        <div className="cut-piles">{["左侧", "中央", "右侧"].map((label, index) => <button key={label} className={cutPile === index ? "chosen" : ""} onClick={() => chooseCut(index)} type="button"><div className="mini-stack"><CommonBack compact /></div><span>{label}</span></button>)}</div>
        <p className="soft-note">没有正确的牌堆，只选择视线最先停留的位置。</p>
      </StepShell>}

      {step === "draw" && <StepShell key="draw" eyebrow={`STEP 06 · DRAW ${drawn.length}/${chosenSpread.count}`} title={drawn.length ? "继续抽取下一张" : "从牌阵中召唤一张牌"}>
        <div className="drawn-mini">{drawn.map(({ card, orientation }, index) => <div key={card.id}><span>{chosenSpread.positions[index]}</span><b>{card.nameZh} · {orientation === "upright" ? "正位" : "逆位"}</b></div>)}</div>
        <div className="card-fan">{Array.from({ length: 17 }, (_, index) => <button key={index} style={{ "--i": index } as React.CSSProperties} onClick={drawCard} type="button" aria-label={`随机抽取第 ${drawn.length + 1} 张牌`}><CommonBack compact /></button>)}</div>
        <p className="soft-note">点击任意牌背都会从剩余牌组安全随机抽取，并独立随机生成正逆位；本次仪式不会重复同一张牌，也不会发送任何数据。</p>
      </StepShell>}

      {step === "reading" && <motion.section key="reading" className="reading-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <p className="eyebrow">THE ORACLE HAS ANSWERED</p><h2>神话的镜面已经展开</h2><div className="question-echo">“{question}”</div>
        <div className={`reading-spread spread-${spread}`}>{drawn.map(({ card, orientation }, index) => <TarotCard key={card.id} card={card} orientation={orientation} position={chosenSpread.positions[index]} className={`card-position-${index}`} />)}</div>
        <p className="reading-help">点击任意卡牌，让它水平旋转并显示专属中性解读。</p>
        <section className="oracle-echo" aria-labelledby="oracle-echo-title">
          <div className="oracle-echo-heading"><div><p className="eyebrow">THE THREAD ANSWERS</p><h3 id="oracle-echo-title">命运线的回声</h3></div><span>本地象征规则生成</span></div>
          <div className="oracle-echo-question"><small>你的意图</small><p>“{question}”</p><b>{localOracleReading.theme}</b></div>
          <p className="oracle-echo-opening">{localOracleReading.opening}</p>
          <div className="oracle-thread-grid">{localOracleReading.threads.map((thread, index) => <article key={`${thread.position}-${index}`}><span>{thread.position} · {thread.orientation === "upright" ? "正位" : "逆位"}</span><h4>{thread.title}</h4><p>{thread.text}</p></article>)}</div>
          {localOracleReading.combinations.length > 0 && <div className="oracle-combinations"><small>牌组关系</small>{localOracleReading.combinations.map((combination) => <p key={combination.title}><b>{combination.title}</b>：{combination.text}</p>)}</div>}
          <div className="oracle-synthesis"><small>因果链</small><p>{localOracleReading.causalChain}</p></div>
          <div className="oracle-synthesis"><small>共同主题</small><p>{localOracleReading.commonTheme}</p></div>
          <div className="oracle-synthesis oracle-priorities"><small>处理优先级</small><ol>{localOracleReading.priorities.map((priority) => <li key={priority}>{priority}</li>)}</ol></div>
          <div className="oracle-synthesis"><small>希腊神话桥梁</small><p>{localOracleReading.greekBridge}</p></div>
          <div className="oracle-synthesis oracle-actions"><small>具体行动</small><ol>{localOracleReading.actions.map((action) => <li key={action}>{action}</li>)}</ol></div>
          <p className="oracle-connection-note">本次解读完全由设备内的 78 张牌数据库、牌阵位置规则和预先批准的组合文本生成；不连接 AI 或第三方接口。</p>
        </section>
        <div className="reading-actions"><button className="primary" onClick={saveReading} disabled={saved} type="button">{saved ? "已保存到命运档案" : "保存本次记录"}</button><button className="secondary" onClick={startNewRitual} type="button">开始新的仪式</button></div>
      </motion.section>}

      {step === "archive" && <motion.section key="archive" className="archive-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button className="back-link" onClick={returnToTemple} type="button">← 返回神殿</button><p className="eyebrow">LOCAL ORACLE ARCHIVE</p><h2>我的命运档案</h2><p className="panel-intro">所有记录只存在这个浏览器中。清除浏览器数据会同时清除档案。</p>
        <div className="local-data-tools" aria-label="本地数据管理">
          <div><strong>本地数据管理</strong><span>导出包含档案、收藏与设置的备份；导入只接受 MOIRAI 备份格式。</span></div>
          <div className="local-data-actions">
            <button onClick={exportLocalData} type="button">导出备份</button>
            <label className="import-data-button">导入恢复<input type="file" accept="application/json,.json" onChange={(event) => { void importLocalData(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
            <button className={confirmClear ? "confirm-clear" : ""} onClick={clearAllLocalData} onBlur={() => setConfirmClear(false)} type="button">{confirmClear ? "确认清除" : "清除本地数据"}</button>
          </div>
        </div>
        {archiveMessage && <p className="archive-message" role="status">{archiveMessage}</p>}
        {records.length === 0 ? <div className="empty-archive"><span>◎</span><h3>档案仍是空白</h3><p>完成一次仪式并保存，神谕会在这里留下日期与牌阵。</p><button className="primary" onClick={startNewRitual} type="button">开始第一次仪式</button></div> : <>
          <div className="archive-toolbar"><span>{records.length} 次本地记录</span><small>仅存于当前设备</small></div>
          <div className="archive-list">{records.map((record) => <article key={record.id}><div className="archive-date"><b>{new Date(record.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</b><span>{spreads[record.spread].name}</span></div><h3>{record.question}</h3><div className="archive-card-row">{archiveCards(record).map(({ card, position, orientation = "upright" }) => <div key={card.id}><span>{card.sigil}</span><p><small>{position} · {orientation === "upright" ? "正位" : "逆位"}</small><b>{card.nameZh}</b><em>{card.myth}</em></p></div>)}</div><button className="delete-record" onClick={() => persist(records.filter((item) => item.id !== record.id))} type="button">删除这条记录</button></article>)}</div>
        </>}
      </motion.section>}

      {step === "library" && <motion.section key="library" className="library-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button className="back-link library-home-button" onClick={returnToTemple} type="button">← 返回神殿</button>
        <div className="library-heading"><div><p className="eyebrow">THE MYTHIC ARCHIVE · 78 CARDS</p><h2>希腊神话塔罗图鉴</h2></div><p>每张塔罗牌都是一则神话的镜面。选择牌面，阅读人物、事件、象征与传统牌义如何交叠。</p></div>
        <div className="library-filters" aria-label="按花色筛选">{libraryFilters.map((filter) => <button key={filter.key} className={librarySuit === filter.key ? "active" : ""} onClick={() => setLibrarySuit(filter.key)} type="button">{filter.label}</button>)}</div>
        <div className="library-grid">{libraryCards.map(({ card, index }) => <button className="library-card" key={card.id} onClick={() => setSelectedStoryIndex(index)} type="button" aria-label={`查看${card.nameZh}的希腊故事`}>
          <div className="library-card-image"><CardFace card={card} /></div>
          <span>{card.numeral}</span><strong>{card.nameZh}</strong><small>{card.myth}</small>
        </button>)}</div>
        <AnimatePresence>{selectedStoryIndex !== null && <motion.div className="story-overlay" role="dialog" aria-modal="true" aria-label={`${tarotDeck[selectedStoryIndex].nameZh}的希腊故事`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStoryIndex(null)}>
          <motion.article className="story-dialog" initial={{ y: 30, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .98 }} onClick={(event) => event.stopPropagation()}>
            <button className="story-close" onClick={() => setSelectedStoryIndex(null)} type="button" aria-label="关闭故事">×</button>
            <div className="story-card-preview"><CardFace card={tarotDeck[selectedStoryIndex]} /></div>
            <div className="story-copy"><p className="eyebrow">{tarotDeck[selectedStoryIndex].numeral} · {tarotDeck[selectedStoryIndex].nameEn}</p><h3>{tarotDeck[selectedStoryIndex].nameZh}</h3><h4>{tarotDeck[selectedStoryIndex].myth}</h4><p>{tarotStories[selectedStoryIndex]}</p><div className="story-keywords">{tarotDeck[selectedStoryIndex].keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div><blockquote>{tarotDeck[selectedStoryIndex].interpretation}</blockquote></div>
          </motion.article>
        </motion.div>}</AnimatePresence>
      </motion.section>}
    </AnimatePresence>

    {installHelpOpen && <div className="install-overlay" role="presentation" onClick={() => setInstallHelpOpen(false)}>
      <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(event) => event.stopPropagation()}>
        <button className="install-close" onClick={() => setInstallHelpOpen(false)} type="button" aria-label="关闭安装说明">×</button>
        <p className="eyebrow">INSTALL MOIRAI</p><h2 id="install-title">安装到桌面</h2>
        <div><strong>iPhone／iPad · Safari</strong><p>点击浏览器的分享按钮，再选择“添加到主屏幕”。</p></div>
        <div><strong>Edge／Chrome · 电脑或 Android</strong><p>打开浏览器菜单中的“应用”或“安装应用”，选择安装 MOIRAI。</p></div>
        <small>若已经从桌面图标打开应用，无需再次安装。</small>
      </section>
    </div>}
    <footer><span>© 2026 MOIRAI / TenetJustin</span><p>自我观照工具，不替代医疗、法律或财务专业意见。 · <a href="./terms.html">用户协议</a> · <a href="./copyright.html">版权与版本</a></p><b>奥林匹斯神谕 · LOCAL ONLY</b></footer>
  </main>;
}
