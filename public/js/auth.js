import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const PAGINA_MEDICO = "dashboard.html";
const PAGINA_PACIENTE = "paciente.html";

const formularios = {
  login: document.getElementById("form-login"),
  cadastro: document.getElementById("form-cadastro"),
  recuperar: document.getElementById("form-recuperar")
};

const textosPorPerfil = {
  medico: {
    login: ["Entrar na sua conta", "Use o e-mail e a senha do seu cadastro."],
    cadastro: ["Criar conta de médico", "Preencha os dados para começar a cadastrar pacientes."],
    recuperar: ["Recuperar senha", "Informe seu e-mail e enviaremos um link para criar uma nova senha."]
  },
  paciente: {
    login: ["Área do paciente", "Entre para ver sua situação e suas metas."],
    cadastro: ["Primeiro acesso", "Crie sua senha usando o e-mail que seu médico cadastrou."],
    recuperar: ["Recuperar senha", "Informe seu e-mail e enviaremos um link para criar uma nova senha."]
  }
};

const titulo = document.getElementById("titulo");
const subtitulo = document.getElementById("subtitulo");
const caixaMensagem = document.getElementById("mensagem");
const abaLogin = document.getElementById("aba-login");
const abaCadastro = document.getElementById("aba-cadastro");
const btnMedico = document.getElementById("perfil-medico");
const btnPaciente = document.getElementById("perfil-paciente");

let cadastrando = false;
let perfil = "medico";
let viewAtual = "login";

/* ---------- Navegação entre as telas ---------- */
function mostrar(view) {
  viewAtual = view;
  Object.entries(formularios).forEach(([nome, form]) => {
    form.hidden = nome !== view;
  });
  [titulo.textContent, subtitulo.textContent] = textosPorPerfil[perfil][view];
  abaLogin.setAttribute("aria-selected", view === "login");
  abaCadastro.setAttribute("aria-selected", view === "cadastro");
  limparMensagem();
}

function definirPerfil(novo) {
  perfil = novo;
  btnMedico.setAttribute("aria-selected", novo === "medico");
  btnPaciente.setAttribute("aria-selected", novo === "paciente");
  document.querySelectorAll(".so-medico").forEach((el) => (el.hidden = novo !== "medico"));
  document.querySelectorAll(".so-paciente").forEach((el) => (el.hidden = novo !== "paciente"));
  mostrar(viewAtual);
}
btnMedico.addEventListener("click", () => definirPerfil("medico"));
btnPaciente.addEventListener("click", () => definirPerfil("paciente"));

document.querySelectorAll("[data-view]").forEach((el) => {
  el.addEventListener("click", () => mostrar(el.dataset.view));
});

/* ---------- Mensagens ---------- */
function mostrarMensagem(texto, tipo) {
  caixaMensagem.textContent = texto;
  caixaMensagem.className = `mensagem ${tipo}`;
  caixaMensagem.hidden = false;
}

function limparMensagem() {
  caixaMensagem.hidden = true;
  caixaMensagem.textContent = "";
}

function traduzirErro(codigo) {
  const erros = {
    "auth/invalid-email": "O e-mail informado não é válido.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado. Use a aba “Já tenho cadastro”.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente de novo.",
    "auth/network-request-failed": "Sem conexão. Verifique sua internet."
  };
  return erros[codigo] || "Algo deu errado. Tente novamente.";
}

// erros próprios (sem código do Firebase) mostram a própria mensagem
const textoErro = (erro) => (erro.code ? traduzirErro(erro.code) : erro.message || traduzirErro());

/* ---------- Botão de carregamento ---------- */
async function comCarregamento(form, textoEnvio, acao) {
  const botao = form.querySelector('button[type="submit"]');
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = textoEnvio;
  try {
    await acao();
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

/* ---------- Mostrar / ocultar senha ---------- */
document.querySelectorAll(".ver-senha").forEach((botao) => {
  botao.addEventListener("click", () => {
    const campo = document.getElementById(botao.dataset.alvo);
    const escondida = campo.type === "password";
    campo.type = escondida ? "text" : "password";
    botao.textContent = escondida ? "Ocultar" : "Mostrar";
    botao.setAttribute("aria-label", escondida ? "Ocultar senha" : "Mostrar senha");
  });
});

/* ---------- Descobre se a conta é de médico ou de paciente ---------- */
async function paginaDoUsuario(user) {
  const snap = await getDoc(doc(db, "medicos", user.uid));
  return snap.exists() ? PAGINA_MEDICO : PAGINA_PACIENTE;
}

/* ---------- Login ---------- */
formularios.login.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparMensagem();

  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value;

  if (!email || !senha) {
    mostrarMensagem("Preencha o e-mail e a senha.", "erro");
    return;
  }

  await comCarregamento(formularios.login, "Entrando...", async () => {
    cadastrando = true; // segura o redirecionamento automático até conferir o tipo de conta
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, senha);
      const destino = await paginaDoUsuario(user);
      const esperado = perfil === "medico" ? PAGINA_MEDICO : PAGINA_PACIENTE;
      if (destino !== esperado) {
        await signOut(auth);
        mostrarMensagem(
          perfil === "medico"
            ? "Esta conta não é de médico. Use a aba “Sou paciente”."
            : "Esta conta é de médico. Use a aba “Sou médico”.",
          "erro"
        );
        return;
      }
      window.location.href = destino;
    } catch (erro) {
      mostrarMensagem(textoErro(erro), "erro");
    } finally {
      cadastrando = false;
    }
  });
});

/* ---------- Cadastro ---------- */
formularios.cadastro.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparMensagem();

  const nome = document.getElementById("cad-nome").value.trim();
  const email = document.getElementById("cad-email").value.trim().toLowerCase();
  const senha = document.getElementById("cad-senha").value;
  const senha2 = document.getElementById("cad-senha2").value;
  const crm = document.getElementById("cad-crm").value.trim();
  const uf = document.getElementById("cad-uf").value.trim().toUpperCase();
  const telefone = document.getElementById("cad-tel").value.trim();
  const especialidade = document.getElementById("cad-esp").value.trim();

  if (!nome || !email || !senha) {
    mostrarMensagem("Preencha todos os campos.", "erro");
    return;
  }
  if (perfil === "medico") {
    if (!/^\d{4,8}$/.test(crm) || !/^[A-Z]{2}$/.test(uf) || !especialidade) {
      mostrarMensagem("Informe CRM (só números), UF com 2 letras e a especialidade.", "erro");
      return;
    }
  }
  if (senha.length < 6) {
    mostrarMensagem("A senha precisa ter pelo menos 6 caracteres.", "erro");
    return;
  }
  if (senha !== senha2) {
    mostrarMensagem("As senhas não são iguais.", "erro");
    return;
  }

  await comCarregamento(formularios.cadastro, "Criando conta...", async () => {
    cadastrando = true; // evita redirecionar antes de salvar o perfil
    let user = null;
    try {
      ({ user } = await createUserWithEmailAndPassword(auth, email, senha));
      await updateProfile(user, { displayName: nome });

      if (perfil === "medico") {
        try {
          await setDoc(doc(db, "medicos", user.uid), {
            nome,
            email,
            crm,
            uf,
            especialidade,
            telefone,
            criadoEm: serverTimestamp()
          });
        } catch (erroPerfil) {
          console.error("Não foi possível salvar o perfil do médico:", erroPerfil);
        }
        window.location.href = PAGINA_MEDICO;
      } else {
        // paciente só entra se o médico já o cadastrou com esse e-mail
        const achou = await getDocs(query(collection(db, "pacientes"), where("email", "==", email)));
        if (achou.empty) {
          await deleteUser(user);
          user = null;
          throw new Error("Nenhum cadastro encontrado para este e-mail. Peça ao seu médico para cadastrá-lo primeiro.");
        }
        window.location.href = PAGINA_PACIENTE;
      }
    } catch (erro) {
      mostrarMensagem(textoErro(erro), "erro");
    } finally {
      cadastrando = false;
    }
  });
});

/* ---------- Recuperar senha ---------- */
formularios.recuperar.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparMensagem();

  const email = document.getElementById("rec-email").value.trim();
  if (!email) {
    mostrarMensagem("Informe o e-mail do seu cadastro.", "erro");
    return;
  }

  await comCarregamento(formularios.recuperar, "Enviando...", async () => {
    try {
      await sendPasswordResetEmail(auth, email);
      mostrarMensagem(
        "Se esse e-mail estiver cadastrado, você receberá o link de redefinição. Confira também o spam.",
        "ok"
      );
    } catch (erro) {
      if (erro.code === "auth/user-not-found") {
        mostrarMensagem(
          "Se esse e-mail estiver cadastrado, você receberá o link de redefinição. Confira também o spam.",
          "ok"
        );
      } else {
        mostrarMensagem(traduzirErro(erro.code), "erro");
      }
    }
  });
});

/* ---------- Quem já está logado vai direto para o sistema ---------- */
onAuthStateChanged(auth, async (usuario) => {
  if (usuario && !cadastrando) {
    window.location.href = await paginaDoUsuario(usuario);
  }
});

definirPerfil("medico");
