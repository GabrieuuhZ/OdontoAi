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
            if (!botaoEditar) return;
            const id = Number(botaoEditar.dataset.editarPaciente);
            abrirModalPaciente(id);
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
                    <a class="icon-btn" href="cliente-detalhe.html" aria-label="Ver ficha de ${paciente.nome}">
                        <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                    </a>
                    <span class="icon-btn" role="button" tabindex="0" data-editar-paciente="${paciente.id}" aria-label="Editar ${paciente.nome}">
                        <span class="material-symbols-outlined" aria-hidden="true">edit</span>
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
