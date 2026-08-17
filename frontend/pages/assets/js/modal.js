// assets/js/modal.js
// Modal genérico e reutilizável. Qualquer tela pode chamar abrirModal({...})
// pra mostrar um formulário (Novo Paciente, Editar Agendamento, etc.)
// sem precisar reescrever a mesma marcação toda vez.

function abrirModal({ titulo, camposHtml, aoSalvar, textoSalvar = 'Salvar' }) {
    fecharModal(); // garante que só um modal fique aberto por vez

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';

    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">
                <h3>${titulo}</h3>
                <span class="icon-btn" role="button" tabindex="0" aria-label="Fechar" id="modal-fechar">
                    <span class="material-symbols-outlined" aria-hidden="true">close</span>
                </span>
            </div>
            <form class="modal-form" id="modal-form" novalidate>
                ${camposHtml}
                <div class="modal-actions">
                    <button type="button" class="btn-secundario" id="modal-cancelar">Cancelar</button>
                    <button type="submit" class="btn-primary">${textoSalvar}</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);

    const form = overlay.querySelector('#modal-form');
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        const dados = Object.fromEntries(new FormData(form).entries());
        aoSalvar(dados);
        fecharModal();
    });

    overlay.querySelector('#modal-fechar').addEventListener('click', fecharModal);
    overlay.querySelector('#modal-cancelar').addEventListener('click', fecharModal);

    // Clicar fora da caixa fecha o modal
    overlay.addEventListener('click', (evento) => {
        if (evento.target === overlay) fecharModal();
    });

    document.addEventListener('keydown', fecharComEsc);

    // Foca o primeiro campo pra já poder digitar
    const primeiroCampo = form.querySelector('input, select');
    if (primeiroCampo) primeiroCampo.focus();
}

function fecharComEsc(evento) {
    if (evento.key === 'Escape') fecharModal();
}

function fecharModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', fecharComEsc);
}

// Pequeno helper pra deixar a montagem dos campos mais legível nas outras telas
function campoForm({ label, name, tipo = 'text', valor = '', obrigatorio = false, opcoes = null }) {
    const idCampo = `campo-${name}`;
    const req = obrigatorio ? 'required' : '';

    if (opcoes) {
        const options = opcoes
            .map((opcao) => {
                const valorOpcao = typeof opcao === 'string' ? opcao : opcao.valor;
                const rotuloOpcao = typeof opcao === 'string' ? opcao : opcao.rotulo;
                const selecionado = valorOpcao === valor ? 'selected' : '';
                return `<option value="${valorOpcao}" ${selecionado}>${rotuloOpcao}</option>`;
            })
            .join('');
        return `
            <div class="campo-form">
                <label for="${idCampo}">${label}</label>
                <select id="${idCampo}" name="${name}" ${req}>${options}</select>
            </div>
        `;
    }

    return `
        <div class="campo-form">
            <label for="${idCampo}">${label}</label>
            <input id="${idCampo}" name="${name}" type="${tipo}" value="${valor}" ${req}>
        </div>
    `;
}
