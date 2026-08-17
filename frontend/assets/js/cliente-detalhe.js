// assets/js/cliente-detalhe.js
// Comportamento da tela "Ficha do Paciente": carrega o paciente pelo `id`
// que vem na URL (ex: #cliente-detalhe.html?id=3), preenche os dados
// pessoais, o histórico de consultas e os diagnósticos/observações — e o
// botão Editar Cadastro salva as alterações de volta no "banco" (db.js),
// refletindo também na lista de Clientes.

let fichaPacienteId = null;

function iniciarClienteDetalhe() {
    const id = Number(window.obterParametroDaURL('id'));
    const paciente = db.getPacientes().find((p) => p.id === id);

    if (!id || !paciente) {
        mostrarPacienteNaoEncontrado();
        return;
    }

    fichaPacienteId = id;
    preencherDadosPaciente(paciente);
    renderizarHistoricoConsultas(id);
    renderizarDiagnosticos(id);

    const btnEditar = document.getElementById('btn-editar-cadastro');
    if (btnEditar) {
        btnEditar.addEventListener('click', abrirModalCadastro);
    }
}

function mostrarPacienteNaoEncontrado() {
    const conteudo = document.getElementById('conteudo');
    if (!conteudo) return;
    conteudo.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem 1.8rem;">
            <span class="material-symbols-outlined" style="font-size: 2.4rem; color: var(--color-danger);" aria-hidden="true">person_off</span>
            <h2 style="margin: 0.8rem 0 0.4rem;">Paciente não encontrado</h2>
            <p class="text-muted">O link usado não aponta pra nenhum paciente cadastrado.</p>
            <a href="clientes.html" class="btn-primary" style="display: inline-flex; margin-top: 1.2rem;">Voltar para Clientes</a>
        </div>
    `;
}

function preencherDadosPaciente(paciente) {
    document.getElementById('ficha-nome').textContent = paciente.nome;
    document.getElementById('ficha-cpf').textContent = paciente.cpf || '—';
    document.getElementById('ficha-nascimento').textContent = paciente.nascimento || '—';
    document.getElementById('ficha-telefone').textContent = paciente.telefone || '—';
    document.getElementById('ficha-email').textContent = paciente.email || '—';
    document.getElementById('ficha-endereco').textContent = paciente.endereco || '—';
    document.getElementById('ficha-convenio').textContent = paciente.convenio || '—';

    const statusEl = document.getElementById('ficha-status');
    statusEl.textContent = paciente.status === 'ativo' ? 'Ativo' : 'Inativo';
    statusEl.classList.remove('ativo', 'inativo');
    statusEl.classList.add(paciente.status);
}

function renderizarHistoricoConsultas(id) {
    const tbody = document.getElementById('ficha-historico-tbody');
    if (!tbody) return;

    const historico = db.getHistoricoConsultas(id);

    if (historico.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted">Nenhuma consulta registrada ainda.</td></tr>';
        return;
    }

    tbody.innerHTML = historico.map((consulta) => `
        <tr>
            <td>${consulta.data}</td>
            <td>${consulta.dentista}</td>
            <td>${consulta.procedimento}</td>
            <td><span class="status ${consulta.status}">${rotuloStatus(consulta.status)}</span></td>
        </tr>
    `).join('');
}

function rotuloStatus(status) {
    const rotulos = {
        agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído',
        cancelado: 'Cancelado', faltou: 'Faltou',
    };
    return rotulos[status] || status;
}

function renderizarDiagnosticos(id) {
    const timelineEl = document.getElementById('ficha-timeline');
    if (!timelineEl) return;

    const diagnosticos = db.getDiagnosticosPaciente(id);

    if (diagnosticos.length === 0) {
        timelineEl.innerHTML = '<p class="text-muted">Nenhum diagnóstico ou observação registrada ainda.</p>';
        return;
    }

    timelineEl.innerHTML = diagnosticos.map((item) => `
        <div class="timeline-item">
            <div class="timeline-content">
                <span class="timeline-date">${item.data}</span>
                <h4>${item.titulo}${item.geradoPorIA ? ' <small class="text-muted">(via IA)</small>' : ''}</h4>
                <p>${item.texto}</p>
            </div>
        </div>
    `).join('');
}

function abrirModalCadastro() {
    const nomeEl = document.getElementById('ficha-nome');
    const statusEl = document.getElementById('ficha-status');
    const cpfEl = document.getElementById('ficha-cpf');
    const nascimentoEl = document.getElementById('ficha-nascimento');
    const telefoneEl = document.getElementById('ficha-telefone');
    const emailEl = document.getElementById('ficha-email');
    const enderecoEl = document.getElementById('ficha-endereco');
    const convenioEl = document.getElementById('ficha-convenio');

    const statusAtual = statusEl.classList.contains('ativo') ? 'ativo' : 'inativo';

    const camposHtml = [
        campoForm({ label: 'Nome completo', name: 'nome', valor: nomeEl.textContent, obrigatorio: true }),
        campoForm({ label: 'CPF', name: 'cpf', valor: cpfEl.textContent }),
        campoForm({ label: 'Data de Nascimento', name: 'nascimento', valor: nascimentoEl.textContent }),
        campoForm({ label: 'Telefone', name: 'telefone', valor: telefoneEl.textContent }),
        campoForm({ label: 'Email', name: 'email', tipo: 'email', valor: emailEl.textContent }),
        campoForm({ label: 'Endereço', name: 'endereco', valor: enderecoEl.textContent }),
        campoForm({ label: 'Convênio', name: 'convenio', valor: convenioEl.textContent }),
        campoForm({
            label: 'Status', name: 'status', valor: statusAtual,
            opcoes: [{ valor: 'ativo', rotulo: 'Ativo' }, { valor: 'inativo', rotulo: 'Inativo' }],
        }),
    ].join('');

    abrirModal({
        titulo: 'Editar Cadastro',
        camposHtml,
        textoSalvar: 'Salvar alterações',
        aoSalvar(dados) {
            // Atualiza a tela
            nomeEl.textContent = dados.nome;
            cpfEl.textContent = dados.cpf;
            nascimentoEl.textContent = dados.nascimento;
            telefoneEl.textContent = dados.telefone;
            emailEl.textContent = dados.email;
            enderecoEl.textContent = dados.endereco;
            convenioEl.textContent = dados.convenio;

            statusEl.textContent = dados.status === 'ativo' ? 'Ativo' : 'Inativo';
            statusEl.classList.remove('ativo', 'inativo');
            statusEl.classList.add(dados.status);

            // Atualiza o "banco" de verdade, pra refletir também na lista de Clientes
            const pacientes = db.getPacientes();
            const paciente = pacientes.find((p) => p.id === fichaPacienteId);
            if (paciente) {
                Object.assign(paciente, dados);
                db.salvarPacientes(pacientes);
            }
        },
    });
}
