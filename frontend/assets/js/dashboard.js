// assets/js/dashboard.js
// Comportamento do Dashboard: busca o resumo do dia (numa chamada só, pra
// não fazer 5 requisições separadas) e desenha os cards, o gráfico da
// semana, a agenda de hoje, a tabela de próximas consultas e o donut.
// Chamado pelo roteador (index.js) toda vez que essa página é carregada.

const ROTULOS_STATUS_DASH = {
    agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído',
    cancelado: 'Cancelado', faltou: 'Faltou',
};

async function iniciarDashboard() {
    const hoje = new Date().toISOString().slice(0, 10);

    let resumo;
    try {
        resumo = await db.getResumoDashboard(hoje);
    } catch (erro) {
        console.error('Erro ao carregar o dashboard:', erro);
        return;
    }

    renderizarCardsIndicadores(resumo);
    renderizarGraficoSemana(resumo.semanaBruta, hoje);
    renderizarAgendaHoje(resumo.agendaHoje);
    renderizarProximasConsultas(resumo.agendaHoje);
    renderizarDonutStatus(resumo.statusGeral);
}

function renderizarCardsIndicadores(resumo) {
    const consultasHoje = resumo.agendaHoje.length;

    const elConsultas = document.getElementById('dash-consultas-hoje');
    if (elConsultas) elConsultas.textContent = consultasHoje;

    const elPacientes = document.getElementById('dash-total-pacientes');
    if (elPacientes) elPacientes.textContent = resumo.totalPacientes.toLocaleString('pt-BR');

    const elAgendamentos = document.getElementById('dash-agendamentos-hoje');
    if (elAgendamentos) elAgendamentos.textContent = consultasHoje;

    const elVariacao = document.getElementById('dash-variacao-hoje');
    if (elVariacao) {
        const ontem = resumo.consultasOntem;
        if (ontem === 0) {
            elVariacao.textContent = consultasHoje > 0 ? '+100%' : '0%';
        } else {
            const variacao = Math.round(((consultasHoje - ontem) / ontem) * 100);
            elVariacao.textContent = `${variacao >= 0 ? '+' : ''}${variacao}%`;
        }
    }
}

function renderizarGraficoSemana(semanaBruta, hoje) {
    const container = document.getElementById('dash-grafico-semana');
    if (!container) return;

    const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dataHoje = new Date(`${hoje}T00:00:00`);
    const diaSemanaHoje = dataHoje.getDay();
    const offsetSegunda = diaSemanaHoje === 0 ? -6 : 1 - diaSemanaHoje;
    const segunda = new Date(dataHoje);
    segunda.setDate(dataHoje.getDate() + offsetSegunda);

    const dias = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(segunda);
        d.setDate(segunda.getDate() + i);
        const iso = d.toISOString().slice(0, 10);
        const encontrado = semanaBruta.find((s) => String(s.data).slice(0, 10) === iso);
        dias.push({ label: nomesDias[d.getDay()], total: encontrado ? encontrado.total : 0 });
    }

    const maximo = Math.max(...dias.map((d) => d.total), 1);

    container.innerHTML = dias.map((dia) => `
        <div class="bar-column">
            <span class="bar-value">${dia.total}</span>
            <div class="bar" style="height: ${Math.round((dia.total / maximo) * 100)}%;"></div>
            <small class="bar-day">${dia.label}</small>
        </div>
    `).join('');
}

function renderizarAgendaHoje(agendaHoje) {
    const lista = document.getElementById('dash-agenda-hoje');
    if (!lista) return;

    if (agendaHoje.length === 0) {
        lista.innerHTML = '<li class="text-muted">Nenhum agendamento hoje.</li>';
        return;
    }

    lista.innerHTML = agendaHoje.map((a) => `
        <li class="agenda-item">
            <span class="agenda-time">${a.horario}</span>
            <span class="agenda-bar ${a.status}"></span>
            <div class="agenda-info">
                <h4>${a.paciente_nome}</h4>
                <small class="text-muted">${a.procedimento}</small>
            </div>
            <span class="status ${a.status}">${ROTULOS_STATUS_DASH[a.status]}</span>
        </li>
    `).join('');
}

function renderizarProximasConsultas(agendaHoje) {
    const tbody = document.getElementById('dash-proximas-tbody');
    if (!tbody) return;

    if (agendaHoje.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Nenhuma consulta hoje.</td></tr>';
        return;
    }

    tbody.innerHTML = agendaHoje.map((a) => `
        <tr>
            <td>${a.horario}</td>
            <td>${a.paciente_nome}</td>
            <td>${a.dentista_nome || '—'}</td>
            <td>${a.procedimento}</td>
            <td><span class="status ${a.status}">${ROTULOS_STATUS_DASH[a.status]}</span></td>
        </tr>
    `).join('');
}

function renderizarDonutStatus(statusGeral) {
    const donut = document.getElementById('dash-donut');
    const legenda = document.getElementById('dash-legenda');
    if (!donut || !legenda) return;

    const total = statusGeral.total || 0;

    if (total === 0) {
        legenda.innerHTML = '<li class="text-muted">Sem agendamentos registrados ainda.</li>';
        return;
    }

    const pctConcluidas = Math.round((statusGeral.concluidas / total) * 100);
    const pctAgendadas = Math.round((statusGeral.agendadas / total) * 100);
    const pctCanceladas = 100 - pctConcluidas - pctAgendadas;

    donut.style.background = `conic-gradient(
        var(--color-success) 0% ${pctConcluidas}%,
        var(--color-warning) ${pctConcluidas}% ${pctConcluidas + pctAgendadas}%,
        var(--color-danger) ${pctConcluidas + pctAgendadas}% 100%
    )`;

    legenda.innerHTML = `
        <li><span class="dot green"></span> <span>Concluídas</span> <b>${pctConcluidas}%</b></li>
        <li><span class="dot yellow"></span> <span>Agendadas</span> <b>${pctAgendadas}%</b></li>
        <li><span class="dot red"></span> <span>Canceladas</span> <b>${pctCanceladas}%</b></li>
    `;
}