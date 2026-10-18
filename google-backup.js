/**
 * Login com Google + backup no Google Drive (pasta privada do app).
 *
 * ATENÇÃO: este arquivo NÃO foi testado e NÃO funciona na prévia do Claude.
 * Ele só funciona quando o app estiver hospedado em um endereço seu (https).
 *
 * O que você precisa fazer uma vez (no navegador, no computador):
 *  1. Acesse https://console.cloud.google.com e crie um projeto.
 *  2. Em "APIs e serviços" > "Biblioteca", ative a "Google Drive API".
 *  3. Em "Tela de consentimento OAuth", configure o app (nome e e-mail) e,
 *     enquanto estiver testando, adicione seu Gmail como "usuário de teste".
 *  4. Em "Credenciais" > "Criar credenciais" > "ID do cliente OAuth",
 *     tipo "Aplicativo da Web". Em "Origens JavaScript autorizadas",
 *     coloque o endereço onde o app ficará (ex.: https://meuapp.com).
 *  5. Copie o ID do cliente e cole em CLIENT_ID abaixo.
 *  6. No HTML do app, antes deste arquivo, inclua:
 *     <script src="https://accounts.google.com/gsi/client" async defer></script>
 *
 * Como os dados ficam separados por Gmail:
 *  o escopo "drive.appdata" cria uma pasta escondida que só este app enxerga,
 *  dentro do Drive de CADA conta. Ninguém vê o backup de outra pessoa.
 */

const CLIENT_ID = "COLE_AQUI_SEU_ID_DO_CLIENTE.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata openid email profile";
const NOME_ARQUIVO = "backup-financas.json";

let token = null;
let perfil = null; // { email, name, picture }

// Abre a janela "Continuar com o Google". Devolve os dados da conta.
export function entrarComGoogle() {
  return new Promise((ok, erro) => {
    const cliente = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: async (r) => {
        if (r.error) return erro(r);
        token = r.access_token;
        const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: "Bearer " + token },
        });
        perfil = await resp.json();
        ok(perfil);
      },
    });
    cliente.requestAccessToken();
  });
}

const auth = () => ({ Authorization: "Bearer " + token });

async function acharArquivo() {
  const q = encodeURIComponent(`name='${NOME_ARQUIVO}'`);
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`,
    { headers: auth() }
  );
  const j = await r.json();
  return j.files && j.files[0] ? j.files[0].id : null;
}

// Salva (ou atualiza) o backup. "dados" é o objeto db do app.
export async function salvarBackup(dados) {
  const id = await acharArquivo();
  const meta = { name: NOME_ARQUIVO, ...(id ? {} : { parents: ["appDataFolder"] }) };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify(dados)], { type: "application/json" }));
  const url = `https://www.googleapis.com/upload/drive/v3/files${id ? "/" + id : ""}?uploadType=multipart`;
  const r = await fetch(url, { method: id ? "PATCH" : "POST", headers: auth(), body: form });
  if (!r.ok) throw new Error("Falha ao salvar o backup");
}

// Lê o backup do Drive. Devolve o objeto db, ou null se ainda não existir.
export async function lerBackup() {
  const id = await acharArquivo();
  if (!id) return null;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: auth(),
  });
  return r.json();
}

// Dica para guardar os dados de cada pessoa separados no navegador:
// use uma chave diferente por e-mail, por exemplo  "fin-" + perfil.email
