// assets/js/clientes.js
// Comportamento da tela de Clientes: agora busca e salva os pacientes
// de verdade na API (backend), em vez do localStorage.
// Chamado pelo roteador (index.js) toda vez que essa página é carregada.

let pacientesCache = []; // guarda a última lista buscada, pra não ter que
                          // buscar de novo só pra abrir o modal de editar

async function iniciarClientes() {
    await renderizarTabelaPacientes();

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

// As datas vêm do banco em formato ISO (ex: "2026-06-25T00:00:00.000Z")
// ou null. Isso converte pro formato brasileiro, ou mostra "—".
function formatarDataBr(valorIso) {
    if (!valorIso) return '—';
    // timeZone: 'UTC' evita o problema de "voltar 1 dia" que vimos antes
    // (o navegador, sem isso, aplica o fuso horário local na conversão)
    return new Date(valorIso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

async function renderizarTabelaPacientes() {
    const tbody = document.getElementById('tbody-pacientes');
    if (!tbody) return;

    let pacientes;
    try {
        pacientes = await db.getPacientes();
    } catch (erro) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Não foi possível carregar os pacientes: ${erro.message}</td></tr>`;
        return;
    }

    pacientesCache = pacientes;

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

    const totalPacientes = document.getElementById('total-pacientes');
    if (totalPacientes) totalPacientes.textContent = pacientes.length.toLocaleString('pt-BR');

    const contadorPacientes = document.getElementById('contador-pacientes');
    if (contadorPacientes) contadorPacientes.textContent = `${pacientes.length} pacientes`;
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
                    // Manda o registro COMPLETO de volta (não só o que mudou),
                    // reaproveitando os campos que esse formulário não edita
                    // (email, nascimento, endereço, convênio) — senão a rota
                    // PUT do backend, que sobrescreve a linha inteira, ia
                    // apagar esses dados sem querer.
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
                await renderizarTabelaPacientes();
            } catch (erro) {
                alert(`Não foi possível salvar o paciente: ${erro.message}`);
            }
        },
    });
}

// -------- Receita (prescrição) --------
// Ainda não persiste no banco (a rota POST /api/receitas já existe, mas
// essa conversão específica fica pra quando chegarmos nessa parte) —
// por enquanto continua só gerando o PDF, igual antes.

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