// assets/js/clientes.js
// Comportamento da tela de Clientes: busca os pacientes de verdade na API,
// e aplica busca/filtros/ordenação EM CIMA da lista já carregada (sem
// precisar buscar de novo no servidor a cada letra digitada).
// Chamado pelo roteador (index.js) toda vez que essa página é carregada.

let pacientesCache = []; // guarda a última lista buscada da API

async function iniciarClientes() {
    await buscarERenderizarPacientes();

    const btnNovo = document.getElementById('btn-novo-paciente');
    if (btnNovo) {
        btnNovo.addEventListener('click', () => abrirModalPaciente());
    }

    const tbody = document.getElementById('tbody-pacientes');
    if (tbody) {
        tbody.addEventListener('click', (evento) => {
            const botaoEditar = evento.target.closest('[data-editar-paciente]');
            if (botaoEditar) {
                abrirModalPaciente(Number(botaoEditar.dataset.editarPaciente));
                return;
            }

            const botaoReceita = evento.target.closest('[data-receita-paciente]');
            if (botaoReceita) {
                abrirModalReceita(Number(botaoReceita.dataset.receitaPaciente));
            }
        });
    }

    // Busca e filtros: qualquer mudança refiltra a lista que já está em
    // memória — não faz uma nova chamada à API a cada letra digitada
    document.getElementById('busca-paciente')?.addEventListener('input', aplicarFiltrosClientes);
    document.getElementById('filtro-status')?.addEventListener('change', aplicarFiltrosClientes);
    document.getElementById('filtro-ordenar')?.addEventListener('change', aplicarFiltrosClientes);
    document.getElementById('filtro-data')?.addEventListener('change', aplicarFiltrosClientes);
}

// As datas vêm do banco em formato ISO (ex: "2026-06-25T00:00:00.000Z")
// ou null. Isso converte pro formato brasileiro, ou mostra "—".
function formatarDataBr(valorIso) {
    if (!valorIso) return '—';
    return new Date(valorIso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// Busca a lista completa na API (isso SIM é uma chamada de rede) e guarda em memória
async function buscarERenderizarPacientes() {
    const tbody = document.getElementById('tbody-pacientes');
    if (!tbody) return;

    try {
        pacientesCache = await db.getPacientes();
    } catch (erro) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Não foi possível carregar os pacientes: ${erro.message}</td></tr>`;
        return;
    }

    const totalPacientes = document.getElementById('total-pacientes');
    if (totalPacientes) totalPacientes.textContent = pacientesCache.length.toLocaleString('pt-BR');

    aplicarFiltrosClientes();
}

// Filtra/ordena a lista JÁ CARREGADA (pacientesCache), sem chamar a API de novo
function aplicarFiltrosClientes() {
    const termo = (document.getElementById('busca-paciente')?.value ?? '').trim().toLowerCase();
    const status = document.getElementById('filtro-status')?.value ?? 'todos';
    const ordenarPor = document.getElementById('filtro-ordenar')?.value ?? 'nome';
    const dataMinima = document.getElementById('filtro-data')?.value ?? ''; // "AAAA-MM-DD" ou vazio

    let filtrados = pacientesCache.filter((paciente) => {
        const bateBusca = !termo ||
            paciente.nome.toLowerCase().includes(termo) ||
            (paciente.cpf || '').toLowerCase().includes(termo) ||
            (paciente.telefone || '').toLowerCase().includes(termo);

        const bateStatus = status === 'todos' || paciente.status === status;

        const bateData = !dataMinima || (
            paciente.proximaConsulta && paciente.proximaConsulta.slice(0, 10) >= dataMinima
        );

        return bateBusca && bateStatus && bateData;
    });

    filtrados.sort((a, b) => {
        if (ordenarPor === 'nome') {
            return a.nome.localeCompare(b.nome, 'pt-BR');
        }
        // Pra "próxima/última consulta": quem não tem data nenhuma vai pro final
        const valorA = a[ordenarPor];
        const valorB = b[ordenarPor];
        if (!valorA && !valorB) return 0;
        if (!valorA) return 1;
        if (!valorB) return -1;
        return new Date(valorA) - new Date(valorB);
    });

    renderizarLinhasTabela(filtrados);
}

function renderizarLinhasTabela(pacientes) {
    const tbody = document.getElementById('tbody-pacientes');
    if (!tbody) return;

    if (pacientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Nenhum paciente encontrado com esses filtros.</td></tr>';
    } else {
        tbody.innerHTML = pacientes.map((paciente) => `
            <tr>
                <td>${paciente.nome}</td>
                <td>${paciente.cpf || '—'}</td>
                <td>${paciente.telefone || '—'}</td>
                <td>${formatarDataBr(paciente.ultimaConsulta)}</td>
                <td>${formatarDataBr(paciente.proximaConsulta)}</td>
                <td><span class="status ${paciente.status}">${paciente.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                    <div class="row-actions">
                        <a class="icon-btn" href="cliente-detalhe.html?id=${paciente.id}" aria-label="Ver ficha de ${paciente.nome}">
                            <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                        </a>
                        <span class="icon-btn" role="button" tabindex="0" data-editar-paciente="${paciente.id}" aria-label="Editar ${paciente.nome}">
                            <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                        </span>
                        <span class="icon-btn" role="button" tabindex="0" data-receita-paciente="${paciente.id}" aria-label="Gerar receita para ${paciente.nome}">
                            <span class="material-symbols-outlined" aria-hidden="true">prescriptions</span>
                        </span>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    const contadorPacientes = document.getElementById('contador-pacientes');
    if (contadorPacientes) {
        contadorPacientes.textContent = `${pacientes.length} paciente${pacientes.length === 1 ? '' : 's'}`;
    }
}

function abrirModalPaciente(id = null) {
    const paciente = id ? pacientesCache.find((p) => p.id === id) : null;

    const camposHtml = [
        campoForm({ label: 'Nome completo', name: 'nome', valor: paciente?.nome ?? '', obrigatorio: true }),
        campoForm({ label: 'CPF', name: 'cpf', tipo: 'cpf', valor: paciente?.cpf ?? '' }),
        campoForm({ label: 'Telefone', name: 'telefone', tipo: 'telefone', valor: paciente?.telefone ?? '' }),
        campoForm({
            label: 'Status', name: 'status', valor: paciente?.status ?? 'ativo',
            opcoes: [{ valor: 'ativo', rotulo: 'Ativo' }, { valor: 'inativo', rotulo: 'Inativo' }],
        }),
    ].join('');

    abrirModal({
        titulo: paciente ? `Editar ${paciente.nome}` : 'Novo Paciente',
        camposHtml,
        textoSalvar: paciente ? 'Salvar alterações' : 'Cadastrar',
        async aoSalvar(dados) {
            try {
                if (paciente) {
                    await db.editarPaciente(paciente.id, {
                        nome: dados.nome,
                        cpf: dados.cpf,
                        telefone: dados.telefone,
                        email: paciente.email,
                        nascimento: paciente.nascimento,
                        endereco: paciente.endereco,
                        convenio: paciente.convenio,
                        status: dados.status,
                    });
                } else {
                    await db.criarPaciente({
                        nome: dados.nome,
                        cpf: dados.cpf,
                        telefone: dados.telefone,
                        status: dados.status,
                    });
                }
                await buscarERenderizarPacientes();
            } catch (erro) {
                alert(`Não foi possível salvar o paciente: ${erro.message}`);
            }
        },
    });
}

// -------- Receita (prescrição) --------

function abrirModalReceita(id) {
    const paciente = pacientesCache.find((p) => p.id === id);
    if (!paciente) return;

    const camposHtml = campoForm({
        label: 'Receita', name: 'receita', tipo: 'textarea', linhas: 8, obrigatorio: true,
        valor: '',
    });

    abrirModal({
        titulo: `Receita — ${paciente.nome}`,
        camposHtml,
        textoSalvar: 'Gerar PDF',
        aoSalvar(dados) {
            gerarPdfReceita(paciente, dados.receita);
        },
    });
}

function gerarPdfReceita(paciente, textoReceita) {
    const clinica = db.getClinica();
    const perfil = db.getPerfil();
    const hoje = new Date().toLocaleDateString('pt-BR');

    const areaImpressao = document.createElement('div');
    areaImpressao.id = 'receita-print-area';
    areaImpressao.className = 'receita-print-area';
    areaImpressao.innerHTML = `
        <div class="receita-cabecalho">
            <h2>${clinica.nome}</h2>
            <p>${clinica.endereco}</p>
            <p>${clinica.telefone}</p>
        </div>

        <h3 class="receita-titulo">Receita</h3>

        <div class="receita-dados-grid">
            <div>
                <label>Paciente</label>
                <p>${paciente.nome}</p>
            </div>
            <div>
                <label>CPF</label>
                <p>${paciente.cpf || '—'}</p>
            </div>
            <div>
                <label>Endereço do paciente</label>
                <p>${paciente.endereco || '—'}</p>
            </div>
            <div>
                <label>Data</label>
                <p>${hoje}</p>
            </div>
        </div>

        <div class="receita-corpo">${textoReceita.replace(/\n/g, '<br>')}</div>

        <div class="ia-assinatura">
            <div class="ia-assinatura-linha"></div>
            <p><b>${perfil.nome}</b> — ${perfil.crm}</p>
        </div>
    `;

    document.body.appendChild(areaImpressao);
    document.body.classList.add('print-receita');

    window.print();

    setTimeout(() => {
        document.body.classList.remove('print-receita');
        areaImpressao.remove();
    }, 500);
}