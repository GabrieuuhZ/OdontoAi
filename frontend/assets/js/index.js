// assets/js/index.js
// Roteador simples da aplicação (SPA).
// Em vez de navegar entre arquivos .html, busca o "miolo" de cada
// página em pages/ e injeta dentro de <div id="conteudo">.

const paginas = {
    'index.html': { arquivo: 'pages/dashboard.html', titulo: 'OdontoAi' },
    'clientes.html': { arquivo: 'pages/clientes.html', titulo: 'OdontoAi - Clientes' },
    'cliente-detalhe.html': { arquivo: 'pages/cliente-detalhe.html', titulo: 'OdontoAi - Ficha do Paciente' },
    'agendamentos.html': { arquivo: 'pages/agendamentos.html', titulo: 'OdontoAi - Agendamentos' },
};

const conteudo = document.getElementById('conteudo');

async function carregarPagina(nomePagina, atualizarHistorico = true) {
    const pagina = paginas[nomePagina];
    if (!pagina || !conteudo) return;

    try {
        const resposta = await fetch(pagina.arquivo);
        if (!resposta.ok) throw new Error('Não foi possível carregar ' + pagina.arquivo);
        conteudo.innerHTML = await resposta.text();
    } catch (erro) {
        conteudo.innerHTML = '<p>Não foi possível carregar esta página.</p>';
        console.error(erro);
        return;
    }

    document.title = pagina.titulo;
    marcarLinkAtivo(nomePagina);
    inicializarPagina(nomePagina);
    conteudo.scrollTop = 0;

    if (atualizarHistorico) {
        history.pushState({ pagina: nomePagina }, '', '#' + nomePagina);
    }
}

// Deixa o link certo do menu lateral marcado como "active"
function marcarLinkAtivo(nomePagina) {
    document.querySelectorAll('.sidebar a[href]').forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === nomePagina);
    });
}

// Cada página, ao entrar no DOM, pode precisar religar algum comportamento
// (isso substitui o que antes era feito automaticamente no carregamento do <script>)
function inicializarPagina(nomePagina) {
    // Campo de data de hoje (existe no Dashboard)
    const dateInput = document.getElementById('today-date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // Comportamento específico da tela de Agendamentos (chips de status, data do filtro)
    if (nomePagina === 'agendamentos.html' && typeof iniciarAgendamentos === 'function') {
        iniciarAgendamentos();
    }

    if (nomePagina === 'clientes.html' && typeof iniciarClientes === 'function') {
        iniciarClientes();
    }

    if (nomePagina === 'cliente-detalhe.html' && typeof iniciarClienteDetalhe === 'function') {
        iniciarClienteDetalhe();
    }
}

function paginaPeloHash() {
    const hash = window.location.hash.replace('#', '');
    return paginas[hash] ? hash : 'index.html';
}

// Qualquer clique em link interno (menu lateral ou dentro do conteúdo,
// tipo "Ver ficha", "Ver agenda", "Voltar para Clientes") vira navegação sem reload.
// Links que não estão no mapa de páginas (ex: "#" da Home/IA/Chat) seguem o padrão do navegador.
document.addEventListener('click', (evento) => {
    const link = evento.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!paginas[href]) return;

    evento.preventDefault();
    carregarPagina(href);
});

// Botão voltar/avançar do navegador
window.addEventListener('popstate', () => {
    carregarPagina(paginaPeloHash(), false);
});

// Primeira carga: respeita o hash da URL (ex: recarregou em #clientes.html), senão abre o Dashboard
carregarPagina(paginaPeloHash(), false);
