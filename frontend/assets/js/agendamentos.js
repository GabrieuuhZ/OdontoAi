// assets/js/agendamentos.js
// Comportamento da tela de Agendamentos: desenha a tabela a partir do
// "banco" local (dados.js), liga os chips de status (filtro visual) e os
// botões de Novo Agendamento / Editar / Cancelar.
// Chamado pelo roteador (index.js) toda vez que essa página é carregada.

const ROTULOS_STATUS_AGENDAMENTO = {
    agendado: 'Agendado',
    confirmado: 'Confirmado',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
    faltou: 'Faltou',
};

function iniciarAgendamentos() {
    // Data do filtro começa em hoje
    const agendaDate = document.getElementById('agenda-date');
    if (agendaDate) {
        agendaDate.valueAsDate = new Date();
    }

    renderizarTabelaAgendamentos();
    ligarChipsDeStatus();

    const btnNovo = document.getElementById('btn-novo-agendamento');
    if (btnNovo) {
        btnNovo.addEventListener('click', () => abrirModalAgendamento());
    }

    const tbody = document.getElementById('tbody-agendamentos');
    if (tbody) {
        tbody.addEventListener('click', (evento) => {
            const botaoEditar = evento.target.closest('[data-editar-agendamento]');
            if (botaoEditar) {
                abrirModalAgendamento(Number(botaoEditar.dataset.editarAgendamento));
                return;
            }

            const botaoCancelar = evento.target.closest('[data-cancelar-agendamento]');
            if (botaoCancelar) {
                cancelarAgendamento(Number(botaoCancelar.dataset.cancelarAgendamento));
            }
        });
    }
}

function renderizarTabelaAgendamentos() {
    const tbody = document.getElementById('tbody-agendamentos');
    if (!tbody) return;

    const agendamentos = db.getAgendamentos();
    // Mais cedo primeiro, do jeito que a agenda do dia é lida
    agendamentos.sort((a, b) => a.horario.localeCompare(b.horario));

    tbody.innerHTML = agendamentos.map((agendamento) => {
        const podeCancelar = agendamento.status === 'agendado' || agendamento.status === 'confirmado';
        const rotuloEditar = podeCancelar ? `Editar agendamento de ${agendamento.paciente}` : `Reagendar ${agendamento.paciente}`;

        return `
            <tr>
                <td>${agendamento.horario}</td>
                <td>${agendamento.paciente}</td>
                <td>${agendamento.dentista}</td>
                <td>${agendamento.procedimento}</td>
                <td><span class="status ${agendamento.status}">${ROTULOS_STATUS_AGENDAMENTO[agendamento.status]}</span></td>
                <td>
                    <div class="row-actions">
                        <span class="icon-btn" role="button" tabindex="0" data-editar-agendamento="${agendamento.id}" aria-label="${rotuloEditar}">
                            <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                        </span>
                        ${podeCancelar ? `
                        <span class="icon-btn" role="button" tabindex="0" data-cancelar-agendamento="${agendamento.id}" aria-label="Cancelar agendamento de ${agendamento.paciente}">
                            <span class="material-symbols-outlined" aria-hidden="true">event_busy</span>
                        </span>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    atualizarResumoAgendamentos(agendamentos);

    // Depois de redesenhar, volta o filtro pra "Todos" pra garantir que a linha nova/editada apareça
    const chipTodos = document.querySelector('.status-chips .chip[data-status="todos"]');
    if (chipTodos) aplicarFiltroChip(chipTodos);
}

function atualizarResumoAgendamentos(agendamentos) {
    const hoje = document.getElementById('resumo-hoje');
    if (hoje) hoje.textContent = agendamentos.length;

    const confirmados = document.getElementById('resumo-confirmados');
    if (confirmados) confirmados.textContent = agendamentos.filter((a) => a.status === 'confirmado').length;

    const cancelados = document.getElementById('resumo-cancelados');
    if (cancelados) cancelados.textContent = agendamentos.filter((a) => a.status === 'cancelado' || a.status === 'faltou').length;

    const contador = document.getElementById('contador-agendamentos');
    if (contador) contador.textContent = `${agendamentos.length} agendamentos`;
}

// Chips de status: clicar marca como "ativo" e filtra as linhas da tabela
function ligarChipsDeStatus() {
    const chips = document.querySelectorAll('.status-chips .chip');

    chips.forEach((chip) => {
        chip.addEventListener('click', () => aplicarFiltroChip(chip));

        // Permite ativar o chip com Enter/Espaço, já que ele é uma <span role="button">
        chip.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                chip.click();
            }
        });
    });
}

function aplicarFiltroChip(chipEscolhido) {
    const chips = document.querySelectorAll('.status-chips .chip');
    chips.forEach((c) => c.classList.remove('active'));
    chipEscolhido.classList.add('active');

    const statusEscolhido = chipEscolhido.dataset.status;
    const linhasTabela = document.querySelectorAll('#tbody-agendamentos tr');

    linhasTabela.forEach((linha) => {
        if (statusEscolhido === 'todos') {
            linha.style.display = '';
            return;
        }
        const temEsseStatus = linha.querySelector(`.status.${statusEscolhido}`);
        linha.style.display = temEsseStatus ? '' : 'none';
    });
}

function abrirModalAgendamento(id = null) {
    const agendamentos = db.getAgendamentos();
    const agendamento = id ? agendamentos.find((a) => a.id === id) : null;

    const camposHtml = [
        campoForm({ label: 'Paciente', name: 'paciente', valor: agendamento?.paciente ?? '', obrigatorio: true }),
        campoForm({
            label: 'Dentista', name: 'dentista', valor: agendamento?.dentista ?? 'Dr. Carlos',
            opcoes: ['Dr. Carlos', 'Dra. Julia'],
        }),
        campoForm({
            label: 'Procedimento', name: 'procedimento', valor: agendamento?.procedimento ?? 'Avaliação',
            opcoes: ['Limpeza Dental', 'Clareamento', 'Restauração', 'Avaliação', 'Canal'],
        }),
        campoForm({ label: 'Horário', name: 'horario', tipo: 'time', valor: agendamento?.horario ?? '', obrigatorio: true }),
        campoForm({
            label: 'Status', name: 'status', valor: agendamento?.status ?? 'agendado',
            opcoes: Object.entries(ROTULOS_STATUS_AGENDAMENTO).map(([valor, rotulo]) => ({ valor, rotulo })),
        }),
    ].join('');

    abrirModal({
        titulo: agendamento ? `Editar agendamento de ${agendamento.paciente}` : 'Novo Agendamento',
        camposHtml,
        textoSalvar: agendamento ? 'Salvar alterações' : 'Agendar',
        aoSalvar(dados) {
            if (agendamento) {
                Object.assign(agendamento, dados);
            } else {
                agendamentos.push({ id: db.proximoId(agendamentos), ...dados });
            }

            db.salvarAgendamentos(agendamentos);
            renderizarTabelaAgendamentos();
        },
    });
}

function cancelarAgendamento(id) {
    const agendamentos = db.getAgendamentos();
    const agendamento = agendamentos.find((a) => a.id === id);
    if (!agendamento) return;

    const confirmou = window.confirm(`Cancelar o agendamento de ${agendamento.paciente} às ${agendamento.horario}?`);
    if (!confirmou) return;

    agendamento.status = 'cancelado';
    db.salvarAgendamentos(agendamentos);
    renderizarTabelaAgendamentos();
}
