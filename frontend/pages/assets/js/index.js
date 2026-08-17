// assets/js/index.js
// Roteador simples da aplicação (SPA).
// Em vez de navegar entre arquivos .html, busca o "miolo" de cada
// página em pages/ e injeta dentro de <div id="conteudo">.

const paginas = {
    'index.html': { arquivo: 'pages/dashboard.html', titulo: 'OdontoAi' },
    'clientes.html': { arquivo: 'pages/clientes.html', titulo: 'OdontoAi - Clientes' },
    'cliente-detalhe.html': { arquivo: 'pages/cliente-detalhe.html', titulo: 'OdontoAi - Ficha do Paciente' },
    'agendamentos.html': { arquivo: 'pages/agendamentos.html', titulo: 'OdontoAi - Agendamentos' },
    'chat.html': { arquivo: 'pages/chat.html', titulo: 'OdontoAi - Chat' },
    'configuracoes.html': { arquivo: 'pages/configuracoes.html', titulo: 'OdontoAi - Configurações' },
    'ia.html': { arquivo: 'pages/ia.html', titulo: 'OdontoAi - IA' },
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

    if (nomePagina === 'chat.html' && typeof iniciarChat === 'function') {
        iniciarChat();
    }

    if (nomePagina === 'configuracoes.html' && typeof iniciarConfiguracoes === 'function') {
        iniciarConfiguracoes();
    }

    if (nomePagina === 'ia.html' && typeof iniciarIA === 'function') {
        iniciarIA();
    }

    inserirTopbarNaPagina();
}

// -------- Barra fixa (data + notificação + perfil) --------
// Em vez de ficar numa linha própria (o que deixava um vazio estranho nas
// páginas sem outras ações), ela agora é inserida dentro do "header-actions"
// de CADA página, no mesmo espaço reservado por um <div id="topbar-slot">.
// Como o conteúdo é recriado a cada navegação, isso roda em toda troca de página.
function montarTopbarHTML() {
    return `
        <div class="date">
            <span class="material-symbols-outlined" aria-hidden="true">calendar_month</span>
            <input type="date" id="today-date" aria-label="Data selecionada">
        </div>

        <div class="notification" role="button" tabindex="0" aria-label="Ver notificações">
            <span class="material-symbols-outlined" aria-hidden="true">notifications</span>
            <span class="dot" aria-hidden="true"></span>
        </div>

        <div class="divider"></div>

        <div class="profile" role="button" tabindex="0" aria-label="Abrir menu do perfil">
            <div class="profile-photo">
                <span class="material-symbols-outlined" aria-hidden="true">person</span>
            </div>
            <div class="profile-info">
                <h5 id="header-nome-dentista">Dr. Carlos</h5>
                <small class="text-muted" id="header-cargo-dentista">Dentista</small>
            </div>
            <span class="material-symbols-outlined" aria-hidden="true">expand_more</span>
        </div>
    `;
}

function sincronizarPerfilNoHeader() {
    const nomeHeader = document.getElementById('header-nome-dentista');
    const cargoHeader = document.getElementById('header-cargo-dentista');
    if (nomeHeader && cargoHeader && typeof db !== 'undefined') {
        const perfil = db.getPerfil();
        nomeHeader.textContent = perfil.nome;
        cargoHeader.textContent = perfil.cargo;
    }
}
// Fica global porque configuracoes.js chama de novo depois de salvar um novo nome/cargo
// (nesse ponto o "slot" já foi substituído, então só precisamos atualizar o texto)
window.atualizarTopbar = sincronizarPerfilNoHeader;

function inserirTopbarNaPagina() {
    const slot = document.getElementById('topbar-slot');
    if (!slot) return; // essa página não tem o encaixe (não deveria acontecer, mas por segurança)

    slot.outerHTML = montarTopbarHTML();

    const dateInput = document.getElementById('today-date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    sincronizarPerfilNoHeader();
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

// -------- Botão "Sair" --------
// Por enquanto não existe login de verdade ligado a um servidor, então
// "sair" aqui é simulado: confirma com a pessoa e manda pra tela de login.
// Quando o backend/autenticação estiverem prontos, aqui entra também a
// chamada pra invalidar a sessão/token no servidor antes de redirecionar.
const btnSair = document.getElementById('btn-sair');
if (btnSair) {
    btnSair.addEventListener('click', (evento) => {
        evento.preventDefault();
        const confirmou = window.confirm('Deseja sair da sua conta?');
        if (confirmou) {
            window.location.href = 'login.html';
        }
    });
}

// Primeira carga: respeita o hash da URL (ex: recarregou em #clientes.html), senão abre o Dashboard
carregarPagina(paginaPeloHash(), false);
