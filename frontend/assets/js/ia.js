// assets/js/ia.js
// Comportamento da tela IA: upload de imagens (com nome/tamanho/dimensões),
// busca de paciente com resultado em card, checkbox de consentimento (LGPD,
// com link pro site oficial da ANPD), análise SIMULADA (sorteia achados de
// uma lista fixa em dados.js), e as ações de vincular ao paciente / gerar PDF.
// Chamado pelo roteador (index.js) toda vez que essa página é carregada.

let iaImagensSelecionadas = []; // [{ nome, url, tamanho, largura, altura }]
let iaPacienteSelecionado = null; // objeto do paciente (ou null)
let iaUltimaAnalise = null;
let iaOuvinteFecharBusca = null; // guarda a referência do listener pra poder remover o antigo

function iniciarIA() {
    iaImagensSelecionadas = [];
    iaPacienteSelecionado = null;
    iaUltimaAnalise = null;

    document.getElementById('ia-resultado-card').hidden = true;
    document.getElementById('ia-como-funciona').hidden = false;
    document.getElementById('ia-paciente-card').hidden = true;
    document.getElementById('ia-campo-paciente').hidden = false;

    renderizarImagensIA();

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

    // Antes de adicionar um novo "ouvinte de clique fora da busca", removemos
    // o antigo (se a pessoa já tinha visitado essa página antes nesta sessão).
    // Sem isso, os ouvintes se acumulavam a cada visita e, quando a pessoa saía
    // da página, os antigos continuavam tentando usar um elemento que não
    // existe mais — o que quebrava com erro em qualquer clique no site.
    if (iaOuvinteFecharBusca) {
        document.removeEventListener('click', iaOuvinteFecharBusca);
    }
    iaOuvinteFecharBusca = (evento) => {
        const resultados = document.getElementById('ia-busca-resultados');
        if (!resultados) return; // não estamos mais na página IA, não faz nada
        const dentroDaBusca = evento.target.closest('#ia-campo-paciente');
        if (!dentroDaBusca) {
            resultados.hidden = true;
        }
    };
    document.addEventListener('click', iaOuvinteFecharBusca);

    btnAnalisar.addEventListener('click', analisarImagensIA);

    document.getElementById('ia-btn-pdf').addEventListener('click', () => {
        // Se o dentista escreveu algo antes de imprimir, guarda também
        // (mesmo que ele não tenha vinculado a um paciente ainda)
        if (iaUltimaAnalise) {
            const texto = document.getElementById('ia-diagnostico-texto')?.value.trim() || '';
            iaUltimaAnalise.diagnosticoDentista = texto;
            const analises = db.getAnalises();
            const indice = analises.findIndex((a) => a.id === iaUltimaAnalise.id);
            if (indice !== -1) {
                analises[indice].diagnosticoDentista = texto;
                db.salvarAnalises(analises);
            }
        }

        document.body.classList.add('print-ia');
        window.print();
        setTimeout(() => document.body.classList.remove('print-ia'), 500);
    });

    document.getElementById('ia-btn-salvar-ficha').addEventListener('click', salvarAnaliseNaFichaIA);

    atualizarBotaoAnalisarIA();

    // Isso fica por último, e protegido: se sobrou algum registro de uma
    // versão antiga do app no localStorage (formato diferente do atual),
    // isso NUNCA pode impedir o resto da página (botão, busca de paciente)
    // de funcionar. Por isso vem depois de todos os addEventListener acima,
    // e dentro de um try/catch.
    try {
        renderizarHistoricoIA();
    } catch (erro) {
        console.error('Não foi possível carregar o histórico de análises (dado antigo incompatível?):', erro);
        const tbody = document.getElementById('ia-historico-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Não foi possível carregar o histórico. Tente limpar os dados de teste em Configurações.</td></tr>';
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
    // O botão fica sempre clicável — se faltar algo, mostramos uma
    // mensagem explicando o que falta (em vez de só desabilitar sem dizer
    // por quê, que é o que confundia antes).
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

// -------- Busca e seleção de paciente --------

function renderizarBuscaPacienteIA() {
    const input = document.getElementById('ia-busca-paciente');
    const resultados = document.getElementById('ia-busca-resultados');
    const termo = input.value.trim().toLowerCase();

    if (!termo) {
        resultados.hidden = true;
        resultados.innerHTML = '';
        return;
    }

    const pacientes = db.getPacientes().filter((p) =>
        p.nome.toLowerCase().includes(termo) ||
        p.cpf.includes(termo) ||
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
                <small class="text-muted">CPF ${p.cpf} · ID #${String(p.id).padStart(5, '0')}</small>
            </div>
        </li>
    `).join('');
    resultados.hidden = false;

    resultados.querySelectorAll('li[data-id]').forEach((item) => {
        item.addEventListener('click', () => selecionarPacienteIA(Number(item.dataset.id)));
    });
}

function selecionarPacienteIA(id) {
    iaPacienteSelecionado = db.getPacientes().find((p) => p.id === id) || null;
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
            <small class="text-muted">CPF ${iaPacienteSelecionado.cpf} · ID #${String(iaPacienteSelecionado.id).padStart(5, '0')}</small>
        </div>
        <button type="button" class="ia-btn-remover-paciente" aria-label="Remover paciente vinculado">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
    `;

    card.querySelector('.ia-btn-remover-paciente').addEventListener('click', removerPacienteSelecionadoIA);
}

// -------- Análise (simulada) --------

function analisarImagensIA() {
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

    setTimeout(() => {
        try {
            const quantidadeAchados = 1 + Math.floor(Math.random() * 3);
            const achadosSorteados = [...ACHADOS_POSSIVEIS]
                .sort(() => Math.random() - 0.5)
                .slice(0, quantidadeAchados);

            const agora = new Date();

            iaUltimaAnalise = {
                id: db.proximoId(db.getAnalises()),
                data: agora.toLocaleDateString('pt-BR'),
                hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                pacienteId: iaPacienteSelecionado ? iaPacienteSelecionado.id : null,
                pacienteNome: iaPacienteSelecionado ? iaPacienteSelecionado.nome : null,
                quantidadeImagens: iaImagensSelecionadas.length,
                achados: achadosSorteados,
                diagnosticoDentista: '',
            };

            const analises = db.getAnalises();
            analises.unshift(iaUltimaAnalise);
            db.salvarAnalises(analises);

            renderizarResultadoIA(iaUltimaAnalise);
            renderizarHistoricoIA();
        } catch (erro) {
            // Se algo desse errado, isso garante que o botão nunca fica
            // travado pra sempre em "Analisando..." — e mostra o erro real
            // no console, pra facilitar descobrir o que aconteceu.
            console.error('Erro ao analisar imagens:', erro);
            alert('Ocorreu um erro ao analisar as imagens. Veja o console (F12) para detalhes.');
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

function renderizarResultadoIA(analise) {
    document.getElementById('ia-como-funciona').hidden = true;

    const card = document.getElementById('ia-resultado-card');
    const metaEl = document.getElementById('ia-resultado-meta');
    const listaEl = document.getElementById('ia-achados-lista');
    const observacoesEl = document.getElementById('ia-observacoes-texto');
    const btnSalvarFicha = document.getElementById('ia-btn-salvar-ficha');

    card.hidden = false;

    metaEl.textContent = analise.pacienteNome
        ? `Paciente: ${analise.pacienteNome} · ${analise.data} às ${analise.hora} · ${analise.quantidadeImagens} imagem(ns)`
        : `Sem paciente vinculado · ${analise.data} às ${analise.hora} · ${analise.quantidadeImagens} imagem(ns)`;

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

    // Diagnóstico escrito pelo dentista: mantém o que já tinha sido escrito
    // (se estiver reabrindo do histórico), ou começa em branco pra análise nova
    const textareaDiagnostico = document.getElementById('ia-diagnostico-texto');
    if (textareaDiagnostico) {
        textareaDiagnostico.value = analise.diagnosticoDentista || '';
    }

    // Assinatura: sempre reflete o profissional logado agora
    const perfil = typeof db !== 'undefined' && db.getPerfil ? db.getPerfil() : null;
    document.getElementById('ia-assinatura-nome').textContent = perfil ? perfil.nome : '';
    document.getElementById('ia-assinatura-crm').textContent = perfil ? perfil.crm : '';
    document.getElementById('ia-assinatura-data').textContent = `Emitido em ${analise.data} às ${analise.hora}`;

    btnSalvarFicha.disabled = !analise.pacienteId;
    btnSalvarFicha.innerHTML = analise.pacienteId
        ? '<span class="material-symbols-outlined" aria-hidden="true" style="font-size:1.1rem; vertical-align:middle;">link</span> Vincular ao Paciente'
        : '<span class="material-symbols-outlined" aria-hidden="true" style="font-size:1.1rem; vertical-align:middle;">link_off</span> Selecione um paciente';

    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// -------- Vincular ao paciente --------

function salvarAnaliseNaFichaIA() {
    if (!iaUltimaAnalise || !iaUltimaAnalise.pacienteId) return;

    const resumoAchados = iaUltimaAnalise.achados
        .map((item) => `${item.dente}: ${item.achado} (${item.confianca}%)`)
        .join(' · ');

    const diagnosticoDentista = document.getElementById('ia-diagnostico-texto')?.value.trim() || '';
    const perfil = typeof db !== 'undefined' && db.getPerfil ? db.getPerfil() : null;

    // Guarda o que o dentista escreveu de volta na própria análise (pra
    // não se perder se reabrir essa análise pelo histórico depois)
    iaUltimaAnalise.diagnosticoDentista = diagnosticoDentista;
    const analises = db.getAnalises();
    const indice = analises.findIndex((a) => a.id === iaUltimaAnalise.id);
    if (indice !== -1) {
        analises[indice].diagnosticoDentista = diagnosticoDentista;
        db.salvarAnalises(analises);
    }

    const textoCompleto = diagnosticoDentista
        ? `Achados da IA: ${resumoAchados}\n\nDiagnóstico do dentista: ${diagnosticoDentista}`
        : `Achados da IA: ${resumoAchados}`;

    db.salvarDiagnosticoPaciente(iaUltimaAnalise.pacienteId, {
        data: `${iaUltimaAnalise.data} — Gerado por IA`,
        titulo: 'Sugestão de análise de imagem (IA)',
        texto: textoCompleto,
        geradoPorIA: true,
        // Campos de rastreabilidade: o professor pediu pra guardar o que a
        // IA gerou originalmente separado do que o dentista aprovou/mudou.
        textoOriginalIA: resumoAchados,
        diagnosticoDentista,
        aprovadoPeloDentista: true,
        aprovadoPor: perfil ? perfil.nome : null,
        aprovadoEm: new Date().toLocaleString('pt-BR'),
    });

    const btnSalvarFicha = document.getElementById('ia-btn-salvar-ficha');
    const textoOriginal = btnSalvarFicha.innerHTML;
    btnSalvarFicha.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true" style="font-size:1.1rem; vertical-align:middle;">check</span> Vinculado!';
    setTimeout(() => { btnSalvarFicha.innerHTML = textoOriginal; }, 2000);
}

// -------- Histórico --------

function renderizarHistoricoIA() {
    const tbody = document.getElementById('ia-historico-tbody');
    if (!tbody) return;

    // Filtra qualquer registro que não tenha o formato esperado (pode ter
    // sobrado do localStorage de uma versão antiga do app) — assim um
    // registro incompatível não derruba a lista inteira.
    const analises = db.getAnalises().filter((a) => a && Array.isArray(a.achados));

    if (analises.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Nenhuma análise feita ainda nesta sessão.</td></tr>';
        return;
    }

    tbody.innerHTML = analises.map((analise) => `
        <tr>
            <td>${analise.data} ${analise.hora}</td>
            <td>${analise.pacienteNome || '—'}</td>
            <td>${analise.quantidadeImagens}</td>
            <td>${analise.achados.length} achados</td>
            <td><span class="status concluido">Concluída</span></td>
            <td>
                <div class="row-actions">
                    <span class="icon-btn" role="button" tabindex="0" data-analise-id="${analise.id}" aria-label="Ver análise de ${analise.data}">
                        <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                    </span>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-analise-id]').forEach((botao) => {
        botao.addEventListener('click', () => {
            const analise = db.getAnalises().find((a) => a.id === Number(botao.dataset.analiseId));
            if (analise) {
                iaUltimaAnalise = analise;
                renderizarResultadoIA(analise);
            }
        });
    });
}
