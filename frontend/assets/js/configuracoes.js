// assets/js/configuracoes.js
// Comportamento da tela de Configurações: preenche o formulário com os
// dados salvos (dados.js), salva alterações, e liga o interruptor de
// modo escuro (que realmente troca a aparência do site inteiro, não só
// desta tela — veja a explicação em cima da função aplicarModoEscuro).

function iniciarConfiguracoes() {
    const perfil = db.getPerfil();

    document.getElementById('config-nome').value = perfil.nome;
    document.getElementById('config-crm').value = perfil.crm;
    document.getElementById('config-cargo').value = perfil.cargo;
    document.getElementById('config-email').value = perfil.email;

    const form = document.getElementById('form-perfil');
    if (form) {
        form.addEventListener('submit', (evento) => {
            evento.preventDefault();
            salvarPerfilForm();
        });
    }

    // O interruptor começa marcado ou não, dependendo do que já está ativo agora
    const toggle = document.getElementById('toggle-dark-mode');
    if (toggle) {
        toggle.checked = document.documentElement.classList.contains('dark-mode');
        toggle.addEventListener('change', () => {
            aplicarModoEscuro(toggle.checked);
        });
    }

    const clinica = db.getClinica();
    document.getElementById('config-clinica-nome').value = clinica.nome;
    document.getElementById('config-clinica-telefone').value = clinica.telefone;
    document.getElementById('config-clinica-endereco').value = clinica.endereco;

    const formClinica = document.getElementById('form-clinica');
    if (formClinica) {
        formClinica.addEventListener('submit', (evento) => {
            evento.preventDefault();
            salvarClinicaForm();
        });
    }
}

function salvarClinicaForm() {
    const clinica = {
        nome: document.getElementById('config-clinica-nome').value.trim(),
        telefone: document.getElementById('config-clinica-telefone').value.trim(),
        endereco: document.getElementById('config-clinica-endereco').value.trim(),
    };

    db.salvarClinica(clinica);

    const aviso = document.getElementById('config-clinica-salvo-aviso');
    if (aviso) {
        aviso.hidden = false;
        setTimeout(() => { aviso.hidden = true; }, 2000);
    }
}

function salvarPerfilForm() {
    const perfil = {
        nome: document.getElementById('config-nome').value.trim(),
        crm: document.getElementById('config-crm').value.trim(),
        cargo: document.getElementById('config-cargo').value.trim(),
        email: document.getElementById('config-email').value.trim(),
    };

    db.salvarPerfil(perfil);

    // Atualiza a pré-visualização nesta própria tela
    document.getElementById('config-preview-nome').textContent = perfil.nome;
    document.getElementById('config-preview-cargo').textContent = perfil.cargo;

    // Atualiza também a barra fixa do topo (agora ela é global, fora de #conteudo)
    if (typeof window.atualizarTopbar === 'function') {
        window.atualizarTopbar();
    }

    // Avisa visualmente que salvou, e some depois de 2 segundos
    const aviso = document.getElementById('config-salvo-aviso');
    if (aviso) {
        aviso.hidden = false;
        setTimeout(() => { aviso.hidden = true; }, 2000);
    }
}

// O modo escuro precisa valer pro app inteiro, não só pra essa tela.
// A técnica: uma classe "dark-mode" na tag <html>, e o style.css redefine
// as variáveis de cor (--color-background, --color-dark etc.) dentro dela.
// Como todo o resto do CSS já usa var(--color-...), a troca de tema
// acontece automaticamente em cada card, tabela, botão etc.
function aplicarModoEscuro(ativado) {
    document.documentElement.classList.toggle('dark-mode', ativado);
    localStorage.setItem('odontoai_dark_mode', ativado ? '1' : '0');
}
