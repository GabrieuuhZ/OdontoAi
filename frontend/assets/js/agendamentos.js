// assets/js/agendamentos.js
const ROTULOS_STATUS_AGENDAMENTO = {
    agendado: 'Agendado',
    confirmado: 'Confirmado',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
    faltou: 'Faltou',
};

let agendamentosCache = [];
let pacientesCacheAgenda = [];
let dentistasCache = [];
let statusAtivoAgenda = 'todos';

async function iniciarAgendamentos() {
    const agendaDate = document.getElementById('agenda-date');
    if (agendaDate) agendaDate.valueAsDate = new Date();

    try {
        dentistasCache = await db.getDentistas();
        preencherFiltroDentistas();
    } catch (erro) {
        console.error('Não foi possível carregar dentistas:', erro);
    }

    await buscarERenderizarAgendamentos();
    ligarChipsDeStatus();

    const btnNovo = document.getElementById('btn-novo-agendamento');
    if (btnNovo) btnNovo.addEventListener('click', () => abrirModalAgendamento());

    const tbody = document.getElementById('tbody-agendamentos');
    if (tbody) {
        tbody.addEventListener('click', (evento) => {
            const botaoEditar = evento.target.closest('[data-editar-agendamento]');
            if (botaoEditar) {
                abrirModalAgendamento(Number(botaoEditar.dataset.editarAgendamento));
                return;
            }
            const botaoCancelar = evento.target.closest('[data-cancelar-agendamento]');
            if (botaoCancelar) cancelarAgendamento(Number(botaoCancelar.dataset.cancelarAgendamento));
        });
    }

        document.getElementById('busca-agendamento')?.addEventListener('input', async (evento) => {
        const termo = evento.target.value.trim();
        if (termo) {
            agendamentosCache = await db.buscarAgendamentos(termo);
        } else {
            agendamentosCache = await db.getAgendamentos(document.getElementById('agenda-date')?.value);
        }
        aplicarFiltrosAgendamentos();
    });
    document.getElementById('filtro-dentista')?.addEventListener('change', aplicarFiltrosAgendamentos);
    document.getElementById('filtro-procedimento')?.addEventListener('change', aplicarFiltrosAgendamentos);
    document.getElementById('agenda-date')?.addEventListener('change', buscarERenderizarAgendamentos);
}

function preencherFiltroDentistas() {
    const select = document.getElementById('filtro-dentista');
    if (!select) return;
    select.innerHTML = '<option value="todos">Todos os dentistas</option>' +
        dentistasCache.map((d) => `<option value="${d.id}">${d.nome}</option>`).join('');
}

async function buscarERenderizarAgendamentos() {
    const tbody = document.getElementById('tbody-agendamentos');
    if (!tbody) return;
    const data = document.getElementById('agenda-date')?.value;
    try {
        agendamentosCache = await db.getAgendamentos(data);
    } catch (erro) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Não foi possível carregar: ${erro.message}</td></tr>`;
        return;
    }
    aplicarFiltrosAgendamentos();
}
    db.getResumoSemana(data).then((r) => {
        const el = document.getElementById('resumo-semana');
        if (el) el.textContent = r.total;
    }).catch(() => {});

function aplicarFiltrosAgendamentos() {
    const termo = (document.getElementById('busca-agendamento')?.value ?? '').trim().toLowerCase();
    const dentistaId = document.getElementById('filtro-dentista')?.value ?? 'todos';
    const procedimento = document.getElementById('filtro-procedimento')?.value ?? 'todos';

    const filtrados = agendamentosCache.filter((a) => {
        const bateBusca = !termo || a.paciente_nome.toLowerCase().includes(termo);
        const bateDentista = dentistaId === 'todos' || String(a.dentista_id) === dentistaId;
        const bateProcedimento = procedimento === 'todos' || a.procedimento === procedimento;
        const bateStatus = statusAtivoAgenda === 'todos' || a.status === statusAtivoAgenda;
        return bateBusca && bateDentista && bateProcedimento && bateStatus;
    });

    filtrados.sort((a, b) => a.horario.localeCompare(b.horario));
    renderizarLinhasAgendamentos(filtrados);
    atualizarResumoAgendamentos(agendamentosCache);
}

function renderizarLinhasAgendamentos(agendamentos) {
    const tbody = document.getElementById('tbody-agendamentos');
    if (!tbody) return;

    if (agendamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Nenhum agendamento encontrado.</td></tr>';
    } else {
        tbody.innerHTML = agendamentos.map((a) => {
            const podeCancelar = a.status === 'agendado' || a.status === 'confirmado';
            const rotuloEditar = podeCancelar ? `Editar agendamento de ${a.paciente_nome}` : `Reagendar ${a.paciente_nome}`;
            return `
                <tr>
                    <td>${a.horario}</td>
                    <td>${a.paciente_nome}</td>
                    <td>${a.dentista_nome || '—'}</td>
                    <td>${a.procedimento}</td>
                    <td><span class="status ${a.status}">${ROTULOS_STATUS_AGENDAMENTO[a.status]}</span></td>
                    <td>
                        <div class="row-actions">
                            <span class="icon-btn" role="button" tabindex="0" data-editar-agendamento="${a.id}" aria-label="${rotuloEditar}">
                                <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                            </span>
                            ${podeCancelar ? `
                            <span class="icon-btn" role="button" tabindex="0" data-cancelar-agendamento="${a.id}" aria-label="Cancelar agendamento de ${a.paciente_nome}">
                                <span class="material-symbols-outlined" aria-hidden="true">event_busy</span>
                            </span>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    const contador = document.getElementById('contador-agendamentos');
    if (contador) contador.textContent = `${agendamentos.length} agendamento${agendamentos.length === 1 ? '' : 's'}`;
}

function atualizarResumoAgendamentos(agendamentosDoDia) {
    const hoje = document.getElementById('resumo-hoje');
    if (hoje) hoje.textContent = agendamentosDoDia.length;
    const confirmados = document.getElementById('resumo-confirmados');
    if (confirmados) confirmados.textContent = agendamentosDoDia.filter((a) => a.status === 'confirmado').length;
    const cancelados = document.getElementById('resumo-cancelados');
    if (cancelados) cancelados.textContent = agendamentosDoDia.filter((a) => a.status === 'cancelado' || a.status === 'faltou').length;
}

function ligarChipsDeStatus() {
    const chips = document.querySelectorAll('.status-chips .chip');
    chips.forEach((chip) => {
        chip.addEventListener('click', () => selecionarChip(chip));
        chip.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                chip.click();
            }
        });
    });
}

function selecionarChip(chipEscolhido) {
    document.querySelectorAll('.status-chips .chip').forEach((c) => c.classList.remove('active'));
    chipEscolhido.classList.add('active');
    statusAtivoAgenda = chipEscolhido.dataset.status;
    aplicarFiltrosAgendamentos();
}

async function abrirModalAgendamento(id = null) {
    const agendamento = id ? agendamentosCache.find((a) => a.id === id) : null;

    try {
        pacientesCacheAgenda = await db.getPacientes();
    } catch (erro) {
        alert(`Não foi possível carregar pacientes: ${erro.message}`);
        return;
    }

    const dataAtual = document.getElementById('agenda-date')?.value || new Date().toISOString().slice(0, 10);

    const camposHtml = [
        campoForm({
            label: 'Paciente', name: 'paciente_id',
            valor: agendamento ? String(agendamento.paciente_id) : '',
            opcoes: pacientesCacheAgenda.map((p) => ({ valor: String(p.id), rotulo: p.nome })),
        }),
        campoForm({
            label: 'Dentista', name: 'dentista_id',
            valor: agendamento ? String(agendamento.dentista_id) : String(dentistasCache[0]?.id ?? ''),
            opcoes: dentistasCache.map((d) => ({ valor: String(d.id), rotulo: d.nome })),
        }),
        campoForm({
            label: 'Procedimento', name: 'procedimento', valor: agendamento?.procedimento ?? 'Avaliação',
            opcoes: ['Limpeza Dental', 'Clareamento', 'Restauração', 'Avaliação', 'Canal'],
        }),
        campoForm({
            label: 'Data', name: 'data', tipo: 'date',
            valor: agendamento ? agendamento.data.slice(0, 10) : dataAtual,
            obrigatorio: true,
        }),
        campoForm({ label: 'Horário', name: 'horario', tipo: 'time', valor: agendamento?.horario ?? '', obrigatorio: true }),
        campoForm({
            label: 'Status', name: 'status', valor: agendamento?.status ?? 'agendado',
            opcoes: Object.entries(ROTULOS_STATUS_AGENDAMENTO).map(([valor, rotulo]) => ({ valor, rotulo })),
        }),
    ].join('');

    abrirModal({
        titulo: agendamento ? `Editar agendamento de ${agendamento.paciente_nome}` : 'Novo Agendamento',
        camposHtml,
        textoSalvar: agendamento ? 'Salvar alterações' : 'Agendar',
        async aoSalvar(dados) {
            try {
                const payload = {
                    paciente_id: Number(dados.paciente_id),
                    dentista_id: Number(dados.dentista_id),
                    data: dados.data,
                    horario: dados.horario,
                    procedimento: dados.procedimento,
                    status: dados.status,
                };
                if (agendamento) {
                    await db.editarAgendamento(agendamento.id, payload);
                } else {
                    await db.criarAgendamento(payload);
                }
                await buscarERenderizarAgendamentos();
            } catch (erro) {
                alert(`Não foi possível salvar: ${erro.message}`);
            }
        },
    });
}

async function cancelarAgendamento(id) {
    const agendamento = agendamentosCache.find((a) => a.id === id);
    if (!agendamento) return;
    const confirmou = window.confirm(`Cancelar o agendamento de ${agendamento.paciente_nome} às ${agendamento.horario}?`);
    if (!confirmou) return;
    try {
        await db.editarAgendamento(id, {
            dentista_id: agendamento.dentista_id,
            data: agendamento.data.slice(0, 10),
            horario: agendamento.horario,
            procedimento: agendamento.procedimento,
            status: 'cancelado',
        });
        await buscarERenderizarAgendamentos();
    } catch (erro) {
        alert(`Não foi possível cancelar: ${erro.message}`);
    }
}