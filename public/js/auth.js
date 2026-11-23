import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const PAGINA_DESTINO = "dashboard.html"; // tela que será criada depois

const formularios = {
  login: document.getElementById("form-login"),
  cadastro: document.getElementById("form-cadastro"),
  recuperar: document.getElementById("form-recuperar")
};

const textos = {
  login: ["Entrar na sua conta", "Use o e-mail e a senha do seu cadastro."],
  cadastro: ["Criar conta de médico", "Preencha os dados para começar a cadastrar pacientes."],
  recuperar: ["Recuperar senha", "Informe seu e-mail e enviaremos um link para criar uma nova senha."]
};

const titulo = document.getElementById("titulo");
const subtitulo = document.getElementById("subtitulo");
const caixaMensagem = document.getElementById("mensagem");
const abaLogin = document.getElementById("aba-login");
const abaCadastro = document.getElementById("aba-cadastro");

let cadastrando = false;

/* ---------- Navegação entre as telas ---------- */
function mostrar(view) {
  Object.entries(formularios).forEach(([nome, form]) => {
    form.hidden = nome !== view;
  });
  [titulo.textContent, subtitulo.textContent] = textos[view];
  abaLogin.setAttribute("aria-selected", view === "login");
  abaCadastro.setAttribute("aria-selected", view === "cadastro");
  limparMensagem();
}

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
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      window.location.href = PAGINA_DESTINO;
    } catch (erro) {
      mostrarMensagem(traduzirErro(erro.code), "erro");
    }
  });
});

/* ---------- Cadastro ---------- */
formularios.cadastro.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparMensagem();

  const nome = document.getElementById("cad-nome").value.trim();
  const email = document.getElementById("cad-email").value.trim();
  const senha = document.getElementById("cad-senha").value;
  const senha2 = document.getElementById("cad-senha2").value;

  if (!nome || !email || !senha) {
    mostrarMensagem("Preencha todos os campos.", "erro");
    return;
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
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, senha);
      await updateProfile(user, { displayName: nome });
      try {
        await setDoc(doc(db, "medicos", user.uid), {
          nome,
          email,
          criadoEm: serverTimestamp()
        });
      } catch (erroPerfil) {
        console.error("Não foi possível salvar o perfil do médico:", erroPerfil);
      }
      window.location.href = PAGINA_DESTINO;
    } catch (erro) {
      mostrarMensagem(traduzirErro(erro.code), "erro");
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
onAuthStateChanged(auth, (usuario) => {
  if (usuario && !cadastrando) {
    window.location.href = PAGINA_DESTINO;
  }
});
