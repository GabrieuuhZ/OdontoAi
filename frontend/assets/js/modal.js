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

    // Liga a máscara (CPF/telefone) em qualquer campo que tiver sido
    // marcado com data-mascara — tanto ao digitar quanto no valor que já
    // vier preenchido (ex: abrindo o modal de Editar)
    overlay.querySelectorAll('[data-mascara]').forEach((input) => {
        aplicarMascara(input);
        input.addEventListener('input', () => aplicarMascara(input));
    });

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

// Formata o valor do campo conforme a pessoa digita, baseado no que tem em
// data-mascara ("cpf" ou "telefone"). A técnica: pega só os números que a
// pessoa já digitou, e vai inserindo pontuação/parênteses nas posições certas.
function aplicarMascara(input) {
    const tipo = input.dataset.mascara;
    const somenteNumeros = input.value.replace(/\D/g, ''); // \D = tudo que NÃO é dígito

    if (tipo === 'cpf') {
        input.value = somenteNumeros
            .slice(0, 11) // CPF tem só 11 números, ignora o resto se digitar mais
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }

    if (tipo === 'telefone') {
        input.value = somenteNumeros
            .slice(0, 11) // com DDD + 9 dígitos (celular) = 11 números
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4,5})(\d{4})$/, '$1-$2');
    }
}

// Pequeno helper pra deixar a montagem dos campos mais legível nas outras telas
function campoForm({ label, name, tipo = 'text', valor = '', obrigatorio = false, opcoes = null, linhas = 4 }) {
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

    if (tipo === 'textarea') {
        return `
            <div class="campo-form">
                <label for="${idCampo}">${label}</label>
                <textarea id="${idCampo}" name="${name}" rows="${linhas}" ${req}>${valor}</textarea>
            </div>
        `;
    }

    // CPF e telefone usam type="text" (não "tel"/"number") porque a
    // máscara já cuida de aceitar só número — e isso evita as setinhas
    // de incremento que o navegador mostra em campos type="number"
    if (tipo === 'cpf') {
        return `
            <div class="campo-form">
                <label for="${idCampo}">${label}</label>
                <input id="${idCampo}" name="${name}" type="text" inputmode="numeric"
                    data-mascara="cpf" maxlength="14" placeholder="000.000.000-00"
                    value="${valor}" ${req}>
            </div>
        `;
    }

    if (tipo === 'telefone') {
        return `
            <div class="campo-form">
                <label for="${idCampo}">${label}</label>
                <input id="${idCampo}" name="${name}" type="text" inputmode="numeric"
                    data-mascara="telefone" maxlength="15" placeholder="(00) 00000-0000"
                    value="${valor}" ${req}>
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