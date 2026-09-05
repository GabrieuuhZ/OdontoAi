// assets/js/ia.js
// Comportamento da tela IA: upload de imagens, busca de paciente (agora
// buscando a lista real da API uma vez, e filtrando em memória), análise
// SIMULADA (sorteia achados, mas já SALVA de verdade no banco), e as ações
// de vincular ao paciente (cria um diagnóstico de verdade) / gerar PDF.
// Chamado pelo roteador (index.js) toda vez que essa página é carregada.

let iaImagensSelecionadas = [];
let iaPacientesCache = []; // lista de pacientes buscada uma vez, pra filtrar a busca localmente
let iaPacienteSelecionado = null;
let iaAnalisesCache = []; // histórico já buscado, pra reabrir sem nova chamada
let iaUltimaAnalise = null;
let iaOuvinteFecharBusca = null;

async function iniciarIA() {
    iaImagensSelecionadas = [];
    iaPacienteSelecionado = null;
    iaUltimaAnalise = null;

    document.getElementById('ia-resultado-card').hidden = true;
    document.getElementById('ia-como-funciona').hidden = false;
    document.getElementById('ia-paciente-card').hidden = true;
    document.getElementById('ia-campo-paciente').hidden = false;

    renderizarImagensIA();

    try {
        iaPacientesCache = await db.getPacientes();
    } catch (erro) {
        console.error('Não foi possível carregar pacientes:', erro);
    }

    const dropzone = document.getElementById('ia-dropzone');
    const inputArquivo = document.getElementById('ia-input-arquivo');
    const checkboxConsentimento = document.getElementById('ia-consentimento');
    const btnAnalisar = document.getElementById('ia-btn-analisar');
    const buscaPaciente = document.getElementById('ia-busca-paciente');

    dropzone.addEventListener('click', () => inputArquivo.click());
    dropzone.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault();
            inputArquivo.click();
        }
    });

    ['dragenter', 'dragover'].forEach((evt) => {
        dropzone.addEventListener(evt, (evento) => {
            evento.preventDefault();
            dropzone.classList.add('arrastando');
        });
    });
    ['dragleave', 'drop'].forEach((evt) => {
        dropzone.addEventListener(evt, (evento) => {
            evento.preventDefault();
            dropzone.classList.remove('arrastando');
        });
    });
    dropzone.addEventListener('drop', (evento) => {
        adicionarArquivosIA(evento.dataTransfer.files);
    });

    inputArquivo.addEventListener('change', (evento) => {
        adicionarArquivosIA(evento.target.files);
        inputArquivo.value = '';
    });

    checkboxConsentimento.addEventListener('change', atualizarBotaoAnalisarIA);

    buscaPaciente.addEventListener('input', () => renderizarBuscaPacienteIA());
    buscaPaciente.addEventListener('focus', () => renderizarBuscaPacienteIA());

    if (iaOuvinteFecharBusca) {
        document.removeEventListener('click', iaOuvinteFecharBusca);
    }
    iaOuvinteFecharBusca = (evento) => {
        const resultados = document.getElementById('ia-busca-resultados');
        if (!resultados) return;
        const dentroDaBusca = evento.target.closest('#ia-campo-paciente');
        if (!dentroDaBusca) {
            resultados.hidden = true;
        }
    };
    document.addEventListener('click', iaOuvinteFecharBusca);

    btnAnalisar.addEventListener('click', analisarImagensIA);

    document.getElementById('ia-btn-pdf').addEventListener('click', () => {
        document.body.classList.add('print-ia');
        window.print();
        setTimeout(() => document.body.classList.remove('print-ia'), 500);
    });

    document.getElementById('ia-btn-salvar-ficha').addEventListener('click', salvarAnaliseNaFichaIA);

    atualizarBotaoAnalisarIA();

    try {
        await renderizarHistoricoIA();
    } catch (erro) {
        console.error('Não foi possível carregar o histórico de análises:', erro);
        const tbody = document.getElementById('ia-historico-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Não foi possível carregar o histórico.</td></tr>';
        }
    }
}

// -------- Upload de imagens --------

function formatarTamanhoArquivo(bytes) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function adicionarArquivosIA(arquivos) {
    Array.from(arquivos).forEach((arquivo) => {
        if (!arquivo.type.startsWith('image/')) return;

        const leitor = new FileReader();
        leitor.onload = (evento) => {
            const imagemTeste = new Image();
            imagemTeste.onload = () => {
                iaImagensSelecionadas.push({
                    nome: arquivo.name,
                    url: evento.target.result,
                    tipo: arquivo.type.replace('image/', '').toUpperCase(),
                    tamanho: formatarTamanhoArquivo(arquivo.size),
                    largura: imagemTeste.width,
                    altura: imagemTeste.height,
                });
                renderizarImagensIA();
                atualizarBotaoAnalisarIA();
            };
            imagemTeste.src = evento.target.result;
        };
        leitor.readAsDataURL(arquivo);
    });
}

function removerImagemIA(indice) {
    iaImagensSelecionadas.splice(indice, 1);
    renderizarImagensIA();
    atualizarBotaoAnalisarIA();
}

function renderizarImagensIA() {
    const lista = document.getElementById('ia-imagens-lista');
    if (!lista) return;

    lista.innerHTML = iaImagensSelecionadas.map((imagem, indice) => `
        <div class="ia-imagem-item">
            <img src="${imagem.url}" alt="${imagem.nome}">
            <div class="ia-imagem-info">
                <h4>${imagem.nome}</h4>
                <small class="text-muted">${imagem.tipo} · ${imagem.tamanho} · ${imagem.largura}x${imagem.altura}</small>
            </div>
            <button type="button" class="ia-btn-remover" data-indice="${indice}">Remover</button>
        </div>
    `).join('');

    lista.querySelectorAll('.ia-btn-remover').forEach((botao) => {
        botao.addEventListener('click', () => removerImagemIA(Number(botao.dataset.indice)));
    });
}

function atualizarBotaoAnalisarIA() {
    esconderErroAnaliseIA();
}

function mostrarErroAnaliseIA(mensagem) {
    const erroEl = document.getElementById('ia-erro-analise');
    if (!erroEl) return;
    erroEl.textContent = mensagem;
    erroEl.hidden = false;
}

function esconderErroAnaliseIA() {
    const erroEl = document.getElementById('ia-erro-analise');
    if (erroEl) erroEl.hidden = true;
}

// -------- Busca e seleção de paciente (agora filtra a lista já em memória) --------

function renderizarBuscaPacienteIA() {
    const input = document.getElementById('ia-busca-paciente');
    const resultados = document.getElementById('ia-busca-resultados');
    const termo = input.value.trim().toLowerCase();

    if (!termo) {
        resultados.hidden = true;
        resultados.innerHTML = '';
        return;
    }

    const pacientes = iaPacientesCache.filter((p) =>
        p.nome.toLowerCase().includes(termo) ||
        (p.cpf || '').includes(termo) ||
        String(p.id).includes(termo)
    );

    if (pacientes.length === 0) {
        resultados.innerHTML = '<li class="text-muted" style="padding: 0.8rem 1rem;">Nenhum paciente encontrado</li>';
        resultados.hidden = false;
        return;
    }

    resultados.innerHTML = pacientes.map((p) => `
        <li data-id="${p.id}">
            <div class="avatar blue">${p.nome.charAt(0)}</div>
            <div>
                <h4>${p.nome}</h4>
                <small class="text-muted">CPF ${p.cpf || '—'} · ID #${String(p.id).padStart(5, '0')}</small>
            </div>
        </li>
    `).join('');
    resultados.hidden = false;

    resultados.querySelectorAll('li[data-id]').forEach((item) => {
        item.addEventListener('click', () => selecionarPacienteIA(Number(item.dataset.id)));
    });
}

function selecionarPacienteIA(id) {
    iaPacienteSelecionado = iaPacientesCache.find((p) => p.id === id) || null;
    renderizarPacienteSelecionadoIA();

    document.getElementById('ia-busca-resultados').hidden = true;
    document.getElementById('ia-busca-paciente').value = '';
    document.getElementById('ia-campo-paciente').hidden = true;
    document.getElementById('ia-paciente-card').hidden = false;
}

function removerPacienteSelecionadoIA() {
    iaPacienteSelecionado = null;
    document.getElementById('ia-campo-paciente').hidden = false;
    document.getElementById('ia-paciente-card').hidden = true;
}

function renderizarPacienteSelecionadoIA() {
    const card = document.getElementById('ia-paciente-card');
    if (!iaPacienteSelecionado) {
        card.hidden = true;
        return;
    }

    card.innerHTML = `
        <div class="avatar blue">${iaPacienteSelecionado.nome.charAt(0)}</div>
        <div class="ia-paciente-card-info">
            <h4>${iaPacienteSelecionado.nome}</h4>
            <small class="text-muted">CPF ${iaPacienteSelecionado.cpf || '—'} · ID #${String(iaPacienteSelecionado.id).padStart(5, '0')}</small>
        </div>
        <button type="button" class="ia-btn-remover-paciente" aria-label="Remover paciente vinculado">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
    `;

    card.querySelector('.ia-btn-remover-paciente').addEventListener('click', removerPacienteSelecionadoIA);
}

// -------- Análise (sorteio simulado, mas SALVA de verdade no banco) --------

async function analisarImagensIA() {
    esconderErroAnaliseIA();

    if (iaImagensSelecionadas.length === 0) {
        mostrarErroAnaliseIA('Envie ao menos uma imagem antes de analisar.');
        return;
    }

    const checkboxConsentimento = document.getElementById('ia-consentimento');
    if (!checkboxConsentimento.checked) {
        mostrarErroAnaliseIA('Aceite os termos de consentimento abaixo antes de gerar o diagnóstico.');
        checkboxConsentimento.focus();
        return;
    }

    const btnAnalisar = document.getElementById('ia-btn-analisar');
    const statusEl = document.getElementById('ia-status-analisando');
    const iconeNormal = btnAnalisar.querySelector('.ia-icone-normal');
    const iconeCarregando = btnAnalisar.querySelector('.ia-icone-carregando');
    const textoBotao = document.getElementById('ia-btn-analisar-texto');

    btnAnalisar.disabled = true;
    iconeNormal.hidden = true;
    iconeCarregando.hidden = false;
    textoBotao.textContent = 'Analisando imagens...';
    statusEl.hidden = false;

    // O "delay artificial" continua simulando a IA pensando — só que, quando
    // termina, agora salva de verdade no banco (POST /api/analises-ia)
    setTimeout(async () => {
        try {
            const quantidadeAchados = 1 + Math.floor(Math.random() * 3);
            const achadosSorteados = [...ACHADOS_POSSIVEIS]
                .sort(() => Math.random() - 0.5)
                .slice(0, quantidadeAchados)
                .map(({ dente, achado, confianca }) => ({ dente, achado, confianca }));

            iaUltimaAnalise = await db.criarAnalise({
                paciente_id: iaPacienteSelecionado ? iaPacienteSelecionado.id : null,
                quantidade_imagens: iaImagensSelecionadas.length,
                achados: achadosSorteados,
            });

            renderizarResultadoIA(iaUltimaAnalise);
            await renderizarHistoricoIA();
        } catch (erro) {
            console.error('Erro ao analisar imagens:', erro);
            alert(`Não foi possível salvar a análise: ${erro.message}`);
        } finally {
            statusEl.hidden = true;
            btnAnalisar.disabled = false;
            iconeNormal.hidden = false;
            iconeCarregando.hidden = true;
            textoBotao.textContent = 'Analisar Imagens';
        }
    }, 1500);
}

function gerarObservacoesIA(achados) {
    const partes = achados.map((item) => `${item.achado.toLowerCase()} (${item.dente.toLowerCase()})`);
    return `A análise apontou os seguintes achados, que precisam ser confirmados pelo dentista responsável: ${partes.join('; ')}.`;
}

function formatarDataHoraIA(valorIso) {
    if (!valorIso) return '';
    const d = new Date(valorIso);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function renderizarResultadoIA(analise) {
    document.getElementById('ia-como-funciona').hidden = true;

    const card = document.getElementById('ia-resultado-card');
    const metaEl = document.getElementById('ia-resultado-meta');
    const listaEl = document.getElementById('ia-achados-lista');
    const observacoesEl = document.getElementById('ia-observacoes-texto');
    const btnSalvarFicha = document.getElementById('ia-btn-salvar-ficha');

    card.hidden = false;

    const dataHora = formatarDataHoraIA(analise.criado_em);
    metaEl.textContent = analise.paciente_nome
        ? `Paciente: ${analise.paciente_nome} · ${dataHora} · ${analise.quantidade_imagens} imagem(ns)`
        : `Sem paciente vinculado · ${dataHora} · ${analise.quantidade_imagens} imagem(ns)`;

    listaEl.innerHTML = analise.achados.map((item) => `
        <li class="ia-achado-item">
            <span class="material-symbols-outlined ia-achado-icone" aria-hidden="true">${item.confianca >= 85 ? 'check_circle' : 'warning'}</span>
            <div class="ia-achado-info">
                <h4>${item.achado}</h4>
                <small class="text-muted">Região: ${item.dente}</small>
            </div>
            <span class="ia-achado-confianca-badge">${item.confianca}%</span>
        </li>
    `).join('');

    observacoesEl.textContent = gerarObservacoesIA(analise.achados);

    const textareaDiagnostico = document.getElementById('ia-diagnostico-texto');
    if (textareaDiagnostico) {
        textareaDiagnostico.value = ''; // sempre começa em branco (o texto só persiste quando vira um diagnóstico salvo)
    }

    const perfil = typeof db !== 'undefined' && db.getPerfil ? db.getPerfil() : null;
    document.getElementById('ia-assinatura-nome').textContent = perfil ? perfil.nome : '';
    document.getElementById('ia-assinatura-crm').textContent = perfil ? perfil.crm : '';
    document.getElementById('ia-assinatura-data').textContent = `Emitido em ${dataHora}`;

    btnSalvarFicha.disabled = !analise.paciente_id;
    btnSalvarFicha.innerHTML = analise.paciente_id
        ? '<span class="material-symbols-outlined" aria-hidden="true" style="font-size:1.1rem; vertical-align:middle;">link</span> Vincular ao Paciente'
        : '<span class="material-symbols-outlined" aria-hidden="true" style="font-size:1.1rem; vertical-align:middle;">link_off</span> Selecione um paciente';

    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// -------- Vincular ao paciente (cria um diagnóstico de verdade) --------

async function salvarAnaliseNaFichaIA() {
    if (!iaUltimaAnalise || !iaUltimaAnalise.paciente_id) return;

    const resumoAchados = iaUltimaAnalise.achados
        .map((item) => `${item.dente}: ${item.achado} (${item.confianca}%)`)
        .join(' · ');

    const diagnosticoDentista = document.getElementById('ia-diagnostico-texto')?.value.trim() || '';

    const textoCompleto = diagnosticoDentista
        ? `Achados da IA: ${resumoAchados}\n\nDiagnóstico do dentista: ${diagnosticoDentista}`
        : `Achados da IA: ${resumoAchados}`;

    const btnSalvarFicha = document.getElementById('ia-btn-salvar-ficha');
    const textoOriginal = btnSalvarFicha.innerHTML;

    try {
        await db.salvarDiagnosticoPaciente(iaUltimaAnalise.paciente_id, {
            titulo: 'Sugestão de análise de imagem (IA)',
            texto: textoCompleto,
            textoOriginalIA: resumoAchados,
            diagnosticoDentista,
            geradoPorIA: true,
        });

        btnSalvarFicha.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true" style="font-size:1.1rem; vertical-align:middle;">check</span> Vinculado!';
        setTimeout(() => { btnSalvarFicha.innerHTML = textoOriginal; }, 2000);
    } catch (erro) {
        alert(`Não foi possível salvar na ficha do paciente: ${erro.message}`);
    }
}

// -------- Histórico --------

async function renderizarHistoricoIA() {
    const tbody = document.getElementById('ia-historico-tbody');
    if (!tbody) return;

    iaAnalisesCache = (await db.getAnalises()).filter((a) => a && Array.isArray(a.achados));

    if (iaAnalisesCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Nenhuma análise feita ainda.</td></tr>';
        return;
    }

    tbody.innerHTML = iaAnalisesCache.map((analise) => `
        <tr>
            <td>${formatarDataHoraIA(analise.criado_em)}</td>
            <td>${analise.paciente_nome || '—'}</td>
            <td>${analise.quantidade_imagens}</td>
            <td>${analise.achados.length} achados</td>
            <td><span class="status concluido">Concluída</span></td>
            <td>
                <div class="row-actions">
                    <span class="icon-btn" role="button" tabindex="0" data-analise-id="${analise.id}" aria-label="Ver análise de ${formatarDataHoraIA(analise.criado_em)}">
                        <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                    </span>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-analise-id]').forEach((botao) => {
        botao.addEventListener('click', () => {
            const analise = iaAnalisesCache.find((a) => a.id === Number(botao.dataset.analiseId));
            if (analise) {
                iaUltimaAnalise = analise;
                renderizarResultadoIA(analise);
            }
        });
    });
}