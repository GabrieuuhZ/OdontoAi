// assets/js/clientes.js
// Comportamento da tela de Clientes: desenha a tabela a partir do "banco"
// local (dados.js) e liga os botões de Novo Paciente / Editar.
// Chamado pelo roteador (index.js) toda vez que essa página é carregada.

function iniciarClientes() {
    renderizarTabelaPacientes();

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
}

function renderizarTabelaPacientes() {
    const tbody = document.getElementById('tbody-pacientes');
    if (!tbody) return;

    const pacientes = db.getPacientes();

    tbody.innerHTML = pacientes.map((paciente) => `
        <tr>
            <td>${paciente.nome}</td>
            <td>${paciente.cpf || '—'}</td>
            <td>${paciente.telefone || '—'}</td>
            <td>${paciente.ultimaConsulta || '—'}</td>
            <td>${paciente.proximaConsulta || '—'}</td>
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

    const totalPacientes = document.getElementById('total-pacientes');
    if (totalPacientes) totalPacientes.textContent = pacientes.length.toLocaleString('pt-BR');

    const contadorPacientes = document.getElementById('contador-pacientes');
    if (contadorPacientes) contadorPacientes.textContent = `${pacientes.length} pacientes`;
}

function abrirModalPaciente(id = null) {
    const pacientes = db.getPacientes();
    const paciente = id ? pacientes.find((p) => p.id === id) : null;

    const camposHtml = [
        campoForm({ label: 'Nome completo', name: 'nome', valor: paciente?.nome ?? '', obrigatorio: true }),
        campoForm({ label: 'CPF', name: 'cpf', valor: paciente?.cpf ?? '' }),
        campoForm({ label: 'Telefone', name: 'telefone', valor: paciente?.telefone ?? '' }),
        campoForm({
            label: 'Próxima consulta', name: 'proximaConsulta', tipo: 'date',
            valor: converterParaInputDate(paciente?.proximaConsulta),
        }),
        campoForm({
            label: 'Status', name: 'status', valor: paciente?.status ?? 'ativo',
            opcoes: [{ valor: 'ativo', rotulo: 'Ativo' }, { valor: 'inativo', rotulo: 'Inativo' }],
        }),
    ].join('');

    abrirModal({
        titulo: paciente ? `Editar ${paciente.nome}` : 'Novo Paciente',
        camposHtml,
        textoSalvar: paciente ? 'Salvar alterações' : 'Cadastrar',
        aoSalvar(dados) {
            const proximaConsulta = dados.proximaConsulta ? converterParaExibicao(dados.proximaConsulta) : '—';

            if (paciente) {
                Object.assign(paciente, {
                    nome: dados.nome,
                    cpf: dados.cpf,
                    telefone: dados.telefone,
                    proximaConsulta,
                    status: dados.status,
                });
            } else {
                pacientes.push({
                    id: db.proximoId(pacientes),
                    nome: dados.nome,
                    cpf: dados.cpf,
                    telefone: dados.telefone,
                    ultimaConsulta: '—',
                    proximaConsulta,
                    status: dados.status,
                });
            }

            db.salvarPacientes(pacientes);
            renderizarTabelaPacientes();
        },
    });
}

// -------- Receita (prescrição) --------

function abrirModalReceita(id) {
    const paciente = db.getPacientes().find((p) => p.id === id);
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

    // Monta uma área de impressão só com o conteúdo da receita, fora do
    // resto da tela — igual o padrão já usado na Análise de IA — e some
    // com ela depois de imprimir.
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

// Datas na tela ficam em dd/mm/aaaa, mas o <input type="date"> trabalha em aaaa-mm-dd
function converterParaInputDate(dataBr) {
    if (!dataBr || dataBr === '—') return '';
    const [dia, mes, ano] = dataBr.split('/');
    return `${ano}-${mes}-${dia}`;
}

function converterParaExibicao(dataInput) {
    if (!dataInput) return '—';
    const [ano, mes, dia] = dataInput.split('-');
    return `${dia}/${mes}/${ano}`;
}
