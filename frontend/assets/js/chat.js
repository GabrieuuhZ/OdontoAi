// assets/js/chat.js
// Comportamento da tela de Chat: lista as conversas (pacientes e equipe),
// mostra as mensagens da conversa selecionada e permite responder.
// Chamado pelo roteador (index.js) toda vez que essa página é carregada.
// Obs: mensagens ficam salvas no localStorage (via dados.js), então "enviar"
// aqui é só local — quando ligarmos ao backend, isso vira uma chamada de API
// (e, pra chegar em tempo real, futuramente algo como WebSocket).

let conversaAtivaId = null;

function iniciarChat() {
    const conversas = db.getConversas();

    // Ao abrir a tela, seleciona a primeira conversa (ou mantém a que já
    // estava aberta, se o usuário só tiver ido em outra aba e voltado)
    if (!conversaAtivaId || !conversas.some((c) => c.id === conversaAtivaId)) {
        conversaAtivaId = conversas[0]?.id ?? null;
    }

    renderizarListaConversas();
    renderizarConversaAtiva();

    const listaEl = document.getElementById('chat-list');
    if (listaEl) {
        listaEl.addEventListener('click', (evento) => {
            const item = evento.target.closest('[data-conversa-id]');
            if (!item) return;
            conversaAtivaId = Number(item.dataset.conversaId);
            renderizarListaConversas();
            renderizarConversaAtiva();
        });
    }

    const buscaEl = document.getElementById('chat-busca');
    if (buscaEl) {
        buscaEl.addEventListener('input', () => renderizarListaConversas());
    }

    const formEl = document.getElementById('chat-input-form');
    if (formEl) {
        formEl.addEventListener('submit', (evento) => {
            evento.preventDefault();
            enviarMensagem();
        });
    }
}

function renderizarListaConversas() {
    const listaEl = document.getElementById('chat-list');
    if (!listaEl) return;

    const termo = (document.getElementById('chat-busca')?.value ?? '').trim().toLowerCase();
    const conversas = db.getConversas()
        .filter((c) => c.nome.toLowerCase().includes(termo));

    listaEl.innerHTML = conversas.map((conversa) => {
        const ultima = conversa.mensagens[conversa.mensagens.length - 1];
        const ativa = conversa.id === conversaAtivaId ? 'ativa' : '';

        return `
            <li class="chat-list-item ${ativa}" data-conversa-id="${conversa.id}" role="button" tabindex="0">
                <div class="avatar ${conversa.avatarCor}">${conversa.avatarLetra}</div>
                <div class="msg-info">
                    <h4>${conversa.nome}</h4>
                    <small class="text-muted">${ultima ? ultima.texto : 'Sem mensagens ainda'}</small>
                </div>
                <small class="msg-time">${ultima ? ultima.hora : ''}</small>
            </li>
        `;
    }).join('') || '<li class="text-muted" style="padding: 1rem;">Nenhuma conversa encontrada</li>';
}

function renderizarConversaAtiva() {
    const headerEl = document.getElementById('chat-window-header');
    const mensagensEl = document.getElementById('chat-messages');
    if (!headerEl || !mensagensEl) return;

    const conversa = db.getConversas().find((c) => c.id === conversaAtivaId);

    if (!conversa) {
        headerEl.innerHTML = '';
        mensagensEl.innerHTML = '<p class="text-muted" style="padding: 1rem;">Selecione uma conversa</p>';
        return;
    }

    headerEl.innerHTML = `
        <div class="avatar ${conversa.avatarCor}">${conversa.avatarLetra}</div>
        <div>
            <h4>${conversa.nome}</h4>
            <small class="text-muted">${conversa.papel}</small>
        </div>
    `;

    mensagensEl.innerHTML = conversa.mensagens.map((mensagem) => `
        <div class="message-bubble ${mensagem.autor === 'eu' ? 'minha' : 'outro'}">
            <p>${mensagem.texto}</p>
            <small>${mensagem.hora}</small>
        </div>
    `).join('');

    // Rola pro final, pra sempre mostrar a mensagem mais recente
    mensagensEl.scrollTop = mensagensEl.scrollHeight;
}

function enviarMensagem() {
    const inputEl = document.getElementById('chat-input');
    if (!inputEl) return;

    const texto = inputEl.value.trim();
    if (!texto || !conversaAtivaId) return;

    const conversas = db.getConversas();
    const conversa = conversas.find((c) => c.id === conversaAtivaId);
    if (!conversa) return;

    const agora = new Date();
    const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

    conversa.mensagens.push({ autor: 'eu', texto, hora });
    db.salvarConversas(conversas);

    inputEl.value = '';
    renderizarListaConversas();
    renderizarConversaAtiva();
}
