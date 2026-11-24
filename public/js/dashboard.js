import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { esc, calcIMC, classificar, fmtData, hoje, tag } from "./util.js";

const area = document.getElementById("area");
const lista = document.getElementById("lista");
let medico = null, pacientes = [], atual = null, avs = [], metas = [];

document.getElementById("sair").onclick = () => signOut(auth).then(() => (location.href = "index.html"));
document.getElementById("novo").onclick = formPaciente;
document.getElementById("busca").oninput = desenharLista;

onAuthStateChanged(auth, async (u) => {
  if (!u) return (location.href = "index.html");
  const snap = await getDoc(doc(db, "medicos", u.uid));
  if (!snap.exists()) return (location.href = "paciente.html");
  medico = { uid: u.uid, ...snap.data() };
  document.getElementById("quem").textContent = `Dr(a). ${medico.nome} · CRM ${medico.crm}/${medico.uf}`;
  await carregarPacientes();
});

async function carregarPacientes() {
  const s = await getDocs(query(collection(db, "pacientes"), where("medicoId", "==", medico.uid)));
  pacientes = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.nome.localeCompare(b.nome));
  desenharLista();
}

function desenharLista() {
  const t = document.getElementById("busca").value.toLowerCase();
  const itens = pacientes.filter((p) => p.nome.toLowerCase().includes(t));
  lista.innerHTML = itens.length
    ? itens.map((p) => `<button class="pac ${p.id === atual?.id ? "ativo" : ""}" data-id="${p.id}">${esc(p.nome)}<small>${esc(p.email)}</small></button>`).join("")
    : `<div class="vazio">Nenhum paciente.</div>`;
  lista.querySelectorAll(".pac").forEach((b) => (b.onclick = () => abrir(b.dataset.id)));
}

/* ---------- Novo paciente ---------- */
function formPaciente() {
  atual = null; desenharLista();
  area.innerHTML = `<form class="card" id="fp"><h2>Novo paciente</h2><div id="msg" class="mensagem erro" hidden></div>
  <label>Nome completo</label><input name="nome" required>
  <div class="g2"><div><label>E-mail (será usado no acesso do paciente)</label><input name="email" type="email" required></div>
  <div><label>Telefone</label><input name="telefone" type="tel"></div>
  <div><label>Data de nascimento</label><input name="nascimento" type="date" required></div>
  <div><label>Sexo</label><select name="sexo"><option>Feminino</option><option>Masculino</option><option>Outro</option></select></div>
  <div><label>Altura (cm)</label><input name="altura" type="number" min="50" max="250" required></div></div>
  <button style="margin-top:1rem">Salvar paciente</button></form>`;
  document.getElementById("fp").onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    f.email = f.email.trim().toLowerCase(); f.nome = f.nome.trim(); f.altura = Number(f.altura);
    if (pacientes.some((p) => p.email === f.email)) {
      const m = document.getElementById("msg"); m.textContent = "Você já cadastrou um paciente com esse e-mail."; m.hidden = false; return;
    }
    const ref = await addDoc(collection(db, "pacientes"), { ...f, medicoId: medico.uid, criadoEm: serverTimestamp() });
    await carregarPacientes(); abrir(ref.id);
  };
}

/* ---------- Detalhe do paciente ---------- */
async function abrir(id) {
  atual = pacientes.find((p) => p.id === id); desenharLista();
  const base = collection(db, "pacientes", id);
  const [a, m] = await Promise.all([getDocs(query(collection(base, "avaliacoes"), orderBy("data", "desc"))), getDocs(collection(base, "metas"))]);
  avs = a.docs.map((d) => ({ id: d.id, ...d.data() }));
  metas = m.docs.map((d) => ({ id: d.id, ...d.data() }));
  desenharPaciente();
}

const idade = (n) => Math.floor((Date.now() - new Date(n)) / 31557600000);

function desenharPaciente() {
  const p = atual, ult = avs[0];
  area.innerHTML = `
  <div class="card"><div style="display:flex;justify-content:space-between;gap:1rem"><div><h2>${esc(p.nome)}</h2>
    <div class="mt">${idade(p.nascimento)} anos · ${esc(p.sexo)} · ${p.altura} cm · ${esc(p.email)}</div></div>
    <button class="perigo" id="excluir">Excluir</button></div>
    ${ult ? `<p><span class="imc">${ult.imc.toFixed(1)}</span> ${tag(ult.imc)}<br><span class="mt">IMC em ${fmtData(ult.data)} · ${ult.peso} kg</span></p>` : `<p class="mt">Nenhuma avaliação ainda.</p>`}</div>

  <form class="card" id="fa"><h3>Nova avaliação (consulta)</h3>
    <div class="g3"><div><label>Data</label><input name="data" type="date" value="${hoje()}" required></div>
    <div><label>Peso (kg)</label><input name="peso" type="number" step="0.1" min="2" max="400" required></div>
    <div><label>Altura (cm)</label><input name="altura" type="number" value="${p.altura}" min="50" max="250" required></div></div>
    <label>Observações</label><input name="obs">
    <p id="previa" class="mt">Informe o peso para calcular o IMC.</p><button>Salvar avaliação</button></form>

  <div class="card"><h3>Histórico</h3>${avs.length ? `<div style="overflow-x:auto"><table><tr><th>Data</th><th>Peso</th><th>IMC</th><th>Classificação</th><th>Variação</th><th>Obs.</th></tr>
    ${avs.map((a, i) => { const ant = avs[i + 1], v = ant ? a.peso - ant.peso : null;
      return `<tr><td>${fmtData(a.data)}</td><td>${a.peso} kg</td><td>${a.imc.toFixed(1)}</td><td>${tag(a.imc)}</td><td>${v === null ? "—" : (v > 0 ? "+" : "") + v.toFixed(1) + " kg"}</td><td>${esc(a.obs)}</td></tr>`; }).join("")}</table></div>` : `<div class="vazio">Sem avaliações.</div>`}</div>

  <div class="card"><h3>Metas</h3>
    <form id="fm"><div class="g3"><div><label>Meta</label><input name="titulo" placeholder="Ex.: Chegar a 75 kg" required></div>
    <div><label>Peso alvo (kg, opcional)</label><input name="alvo" type="number" step="0.1"></div>
    <div><label>Prazo</label><input name="prazo" type="date"></div></div><button class="sec" style="margin:.7rem 0">Adicionar meta</button></form>
    ${metas.map(cartaMeta).join("") || `<div class="vazio">Nenhuma meta definida.</div>`}</div>`;

  const fa = document.getElementById("fa");
  fa.oninput = () => {
    const peso = +fa.peso.value, alt = +fa.altura.value;
    document.getElementById("previa").innerHTML = peso && alt ? `IMC: <strong>${calcIMC(peso, alt).toFixed(1)}</strong> ${tag(calcIMC(peso, alt))}` : "Informe o peso para calcular o IMC.";
  };
  fa.onsubmit = async (e) => {
    e.preventDefault();
    const peso = +fa.peso.value, alt = +fa.altura.value, imc = calcIMC(peso, alt);
    await addDoc(collection(db, "pacientes", p.id, "avaliacoes"), { data: fa.data.value, peso, altura: alt, imc, classificacao: classificar(imc).txt, obs: fa.obs.value.trim() });
    if (alt !== p.altura) await updateDoc(doc(db, "pacientes", p.id), { altura: alt });
    await carregarPacientes(); abrir(p.id);
  };
  document.getElementById("fm").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    await addDoc(collection(db, "pacientes", p.id, "metas"), { titulo: f.titulo.value.trim(), alvo: f.alvo.value ? +f.alvo.value : null, prazo: f.prazo.value, status: "Em andamento", acompanhamentos: [], criadoEm: serverTimestamp() });
    abrir(p.id);
  };
  document.getElementById("excluir").onclick = async () => {
    if (!confirm(`Excluir ${p.nome}? Os dados do paciente serão apagados.`)) return;
    for (const a of avs) await deleteDoc(doc(db, "pacientes", p.id, "avaliacoes", a.id));
    for (const m of metas) await deleteDoc(doc(db, "pacientes", p.id, "metas", m.id));
    await deleteDoc(doc(db, "pacientes", p.id)); atual = null;
    area.innerHTML = `<div class="card vazio">Paciente excluído.</div>`; carregarPacientes();
  };
  area.querySelectorAll("[data-status]").forEach((s) => (s.onchange = async () => { await updateDoc(doc(db, "pacientes", p.id, "metas", s.dataset.status), { status: s.value }); abrir(p.id); }));
  area.querySelectorAll("[data-acomp]").forEach((b) => (b.onclick = async () => {
    const nota = prompt("Como está esta meta nesta consulta?"); if (nota === null) return;
    await updateDoc(doc(db, "pacientes", p.id, "metas", b.dataset.acomp), { acompanhamentos: arrayUnion({ data: hoje(), peso: avs[0]?.peso ?? null, nota: nota.trim() }) }); abrir(p.id);
  }));
  area.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (confirm("Excluir esta meta?")) { await deleteDoc(doc(db, "pacientes", p.id, "metas", b.dataset.del)); abrir(p.id); } }));
}

function cartaMeta(m) {
  let prog = "";
  if (m.alvo && avs.length) {
    const ini = avs[avs.length - 1].peso, now = avs[0].peso;
    const pct = ini === m.alvo ? 100 : Math.max(0, Math.min(100, ((ini - now) / (ini - m.alvo)) * 100));
    prog = `<div class="barra"><i style="width:${pct}%"></i></div><span class="mt">Início ${ini} kg → atual ${now} kg → alvo ${m.alvo} kg (${pct.toFixed(0)}%)</span>`;
  }
  const ac = (m.acompanhamentos || []).slice(-3).reverse().map((a) => `<li>${fmtData(a.data)}${a.peso ? ` (${a.peso} kg)` : ""}: ${esc(a.nota)}</li>`).join("");
  return `<div class="meta ${m.status === "Alcançada" ? "feita" : ""}"><div style="display:flex;justify-content:space-between;gap:.5rem"><strong>${esc(m.titulo)}</strong>
    <select data-status="${m.id}" style="width:auto">${["Em andamento", "Alcançada", "Não alcançada"].map((s) => `<option ${s === m.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
    <div class="mt">${m.prazo ? "Prazo: " + fmtData(m.prazo) : "Sem prazo"}</div>${prog}${ac ? `<ul class="mt">${ac}</ul>` : ""}
    <button class="link" data-acomp="${m.id}">Registrar acompanhamento</button> <button class="perigo" data-del="${m.id}">Excluir</button></div>`;
}
