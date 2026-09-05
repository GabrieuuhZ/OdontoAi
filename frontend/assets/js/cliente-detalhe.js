// assets/js/cliente-detalhe.js
// Comportamento da tela "Ficha do Paciente": carrega o paciente pelo `id`
// que vem na URL (ex: #cliente-detalhe.html?id=3), preenche os dados
// pessoais, o histórico de consultas e os diagnósticos/observações — tudo
// buscado de verdade na API agora — e o botão Editar Cadastro salva as
// alterações de volta no banco.

let fichaPacienteId = null;

async function iniciarClienteDetalhe() {
    const id = Number(window.obterParametroDaURL('id'));

    if (!id) {
        mostrarPacienteNaoEncontrado();
        return;
    }

    let paciente;
    try {
        paciente = await db.getPaciente(id);
    } catch (erro) {
        mostrarPacienteNaoEncontrado();
        return;
    }

    fichaPacienteId = id;
    preencherDadosPaciente(paciente);
    renderizarHistoricoConsultas(id);
    renderizarDiagnosticos(id);

    const btnEditar = document.getElementById('btn-editar-cadastro');
    if (btnEditar) {
        btnEditar.addEventListener('click', () => abrirModalCadastro(paciente));
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

// As datas vêm do banco em formato ISO (ex: "2026-06-25T00:00:00.000Z") ou null
function formatarDataBr(valorIso) {
    if (!valorIso) return '—';
    return new Date(valorIso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
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

async function renderizarHistoricoConsultas(id) {
    const tbody = document.getElementById('ficha-historico-tbody');
    if (!tbody) return;

    let historico;
    try {
        historico = await db.getHistoricoConsultas(id);
    } catch (erro) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-muted">Não foi possível carregar o histórico: ${erro.message}</td></tr>`;
        return;
    }

    if (historico.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted">Nenhuma consulta registrada ainda.</td></tr>';
        return;
    }

    tbody.innerHTML = historico.map((consulta) => `
        <tr>
            <td>${formatarDataBr(consulta.data)}</td>
            <td>${consulta.dentista_nome || '—'}</td>
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

async function renderizarDiagnosticos(id) {
    const timelineEl = document.getElementById('ficha-timeline');
    if (!timelineEl) return;

    let diagnosticos;
    try {
        diagnosticos = await db.getDiagnosticosPaciente(id);
    } catch (erro) {
        timelineEl.innerHTML = `<p class="text-muted">Não foi possível carregar os diagnósticos: ${erro.message}</p>`;
        return;
    }

    if (diagnosticos.length === 0) {
        timelineEl.innerHTML = '<p class="text-muted">Nenhum diagnóstico ou observação registrada ainda.</p>';
        return;
    }

    timelineEl.innerHTML = diagnosticos.map((item) => `
        <div class="timeline-item">
            <div class="timeline-content">
                <span class="timeline-date">${formatarDataBr(item.criado_em)}</span>
                <h4>${item.titulo}${item.gerado_por_ia ? ' <small class="text-muted">(via IA)</small>' : ''}</h4>
                <p>${item.texto}</p>
            </div>
        </div>
    `).join('');
}

function abrirModalCadastro(paciente) {
    const camposHtml = [
        campoForm({ label: 'Nome completo', name: 'nome', valor: paciente.nome, obrigatorio: true }),
        campoForm({ label: 'CPF', name: 'cpf', tipo: 'cpf', valor: paciente.cpf || '' }),
        campoForm({ label: 'Data de Nascimento', name: 'nascimento', valor: paciente.nascimento || '' }),
        campoForm({ label: 'Telefone', name: 'telefone', tipo: 'telefone', valor: paciente.telefone || '' }),
        campoForm({ label: 'Email', name: 'email', tipo: 'email', valor: paciente.email || '' }),
        campoForm({ label: 'Endereço', name: 'endereco', valor: paciente.endereco || '' }),
        campoForm({ label: 'Convênio', name: 'convenio', valor: paciente.convenio || '' }),
        campoForm({
            label: 'Status', name: 'status', valor: paciente.status,
            opcoes: [{ valor: 'ativo', rotulo: 'Ativo' }, { valor: 'inativo', rotulo: 'Inativo' }],
        }),
    ].join('');

    abrirModal({
        titulo: 'Editar Cadastro',
        camposHtml,
        textoSalvar: 'Salvar alterações',
        async aoSalvar(dados) {
            try {
                await db.editarPaciente(fichaPacienteId, dados);
                Object.assign(paciente, dados);
                preencherDadosPaciente(paciente);
            } catch (erro) {
                alert(`Não foi possível salvar as alterações: ${erro.message}`);
            }
        },
    });
}