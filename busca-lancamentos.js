/**
 * Busca e filtro de lançamentos, inspirado no comportamento do Mobills:
 *  - filtro por características (tipo, categoria, conta, tags, situação, período, valor)
 *  - filtros salvos para reutilizar depois
 *  - período "De"/"Até" com limite de 2 anos para trás (como na regra do app)
 * Extra (não documentado pelo Mobills): busca por texto sem acento e sem diferenciar maiúsculas.
 *
 * JavaScript puro, sem dependências. Funciona no navegador (inclusive em bloco HTML)
 * e no Node. Uso com <script>: remova o "export" das funções ou use type="module".
 */

// ---------- utilidades ----------
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tira acentos
    .toLowerCase()
    .trim();
}

function paraData(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor + "T00:00:00");
  return isNaN(d) ? null : d;
}

// ---------- busca principal ----------
/**
 * @param {Array} lancamentos  [{id, descricao, valor, data:'2026-10-15', tipo:'despesa'|'receita'|'transferencia',
 *                               categoria, conta, tags:[], pago:true, obs}]
 * @param {Object} filtro      {texto, tipo, categorias:[], contas:[], tags:[], situacao:'pago'|'pendente',
 *                               de:'2026-01-01', ate:'2026-12-31', valorMin, valorMax}
 * @returns {{itens:Array, total:number, receitas:number, despesas:number}}
 */
export function buscarLancamentos(lancamentos, filtro = {}) {
  const {
    texto = "", tipo, categorias = [], contas = [], tags = [],
    situacao, de, ate, valorMin, valorMax,
  } = filtro;

  const termos = normalizar(texto).split(/\s+/).filter(Boolean);
  const cats = categorias.map(normalizar);
  const ctas = contas.map(normalizar);
  const tgs = tags.map(normalizar);
  const dDe = paraData(de);
  const dAte = paraData(ate);

  // regra do Mobills: para ver mais de 2 anos atrás, reduza o "Até"
  if (dDe && dAte) {
    const limite = new Date(dAte);
    limite.setFullYear(limite.getFullYear() - 2);
    if (dDe < limite) {
      console.warn("Período maior que 2 anos: reduza a data final para enxergar datas mais antigas.");
    }
  }

  const itens = lancamentos.filter((l) => {
    const data = paraData(l.data);
    if (tipo && l.tipo !== tipo) return false;
    if (cats.length && !cats.includes(normalizar(l.categoria))) return false;
    if (ctas.length && !ctas.includes(normalizar(l.conta))) return false;
    if (tgs.length) {
      const dele = (l.tags || []).map(normalizar);
      if (!tgs.some((t) => dele.includes(t))) return false;
    }
    if (situacao === "pago" && !l.pago) return false;
    if (situacao === "pendente" && l.pago) return false;
    if (dDe && data && data < dDe) return false;
    if (dAte && data && data > dAte) return false;
    if (valorMin != null && Math.abs(l.valor) < valorMin) return false;
    if (valorMax != null && Math.abs(l.valor) > valorMax) return false;

    if (termos.length) {
      const palheiro = normalizar(
        [l.descricao, l.categoria, l.conta, l.obs, ...(l.tags || [])].join(" ")
      );
      if (!termos.every((t) => palheiro.includes(t))) return false;
    }
    return true;
  });

  itens.sort((a, b) => paraData(b.data) - paraData(a.data)); // mais recentes primeiro

  const soma = (t) =>
    itens.filter((l) => l.tipo === t).reduce((s, l) => s + Math.abs(l.valor), 0);
  const receitas = soma("receita");
  const despesas = soma("despesa");
  return { itens, total: receitas - despesas, receitas, despesas };
}

// ---------- filtros salvos ("Salvar filtro") ----------
const CHAVE = "filtros-salvos-v1";
let memoria = {}; // plano B quando o navegador bloqueia o armazenamento

function ler() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || {};
  } catch {
    return memoria;
  }
}
function gravar(obj) {
  memoria = obj;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(obj));
  } catch {
    /* sem armazenamento: fica só na memória da página */
  }
}

export function salvarFiltro(nome, filtro) {
  const todos = ler();
  todos[nome] = filtro;
  gravar(todos);
}
export function listarFiltrosSalvos() {
  return Object.keys(ler());
}
export function aplicarFiltroSalvo(lancamentos, nome) {
  const filtro = ler()[nome];
  if (!filtro) throw new Error(`Filtro "${nome}" não encontrado`);
  return buscarLancamentos(lancamentos, filtro);
}

// ---------- exemplo ----------
// const dados = [
//   { id: 1, descricao: "Almoço no Pão de Açúcar", valor: -48.9, data: "2026-10-12",
//     tipo: "despesa", categoria: "Alimentação", conta: "Nubank", tags: ["mercado"], pago: true },
// ];
// buscarLancamentos(dados, { texto: "pao acucar", tipo: "despesa", de: "2026-10-01", ate: "2026-10-31" });
// salvarFiltro("Mercado do mês", { tags: ["mercado"], de: "2026-10-01", ate: "2026-10-31" });
