// assets/js/configuracoes.js
// Comportamento da tela de Configurações: agora busca e salva perfil e
// dados da clínica de verdade na API, e liga o interruptor de modo escuro
// (que continua sendo só do navegador — modo escuro não é "dado", é
// preferência de exibição, então localStorage continua fazendo sentido aqui).

async function iniciarConfiguracoes() {
    let perfil;
    try {
        perfil = await db.getPerfil();
    } catch (erro) {
        console.error('Erro ao carregar perfil:', erro);
        return;
    }

    document.getElementById('config-nome').value = perfil.nome;
    document.getElementById('config-crm').value = perfil.crm || '';
    document.getElementById('config-cargo').value = perfil.cargo || '';
    document.getElementById('config-email').value = perfil.email;

    const form = document.getElementById('form-perfil');
    if (form) {
        form.addEventListener('submit', (evento) => {
            evento.preventDefault();
            salvarPerfilForm();
        });
    }

    const toggle = document.getElementById('toggle-dark-mode');
    if (toggle) {
        toggle.checked = document.documentElement.classList.contains('dark-mode');
        toggle.addEventListener('change', () => {
            aplicarModoEscuro(toggle.checked);
        });
    }

    try {
        const clinica = await db.getClinica();
        if (clinica) {
            document.getElementById('config-clinica-nome').value = clinica.nome;
            document.getElementById('config-clinica-telefone').value = clinica.telefone || '';
            document.getElementById('config-clinica-endereco').value = clinica.endereco || '';
        }
    } catch (erro) {
        console.error('Erro ao carregar clínica:', erro);
    }

    const formClinica = document.getElementById('form-clinica');
    if (formClinica) {
        formClinica.addEventListener('submit', (evento) => {
            evento.preventDefault();
            salvarClinicaForm();
        });
    }
}

async function salvarClinicaForm() {
    const clinica = {
        nome: document.getElementById('config-clinica-nome').value.trim(),
        telefone: document.getElementById('config-clinica-telefone').value.trim(),
        endereco: document.getElementById('config-clinica-endereco').value.trim(),
    };

    try {
        await db.salvarClinica(clinica);
        const aviso = document.getElementById('config-clinica-salvo-aviso');
        if (aviso) {
            aviso.hidden = false;
            setTimeout(() => { aviso.hidden = true; }, 2000);
        }
    } catch (erro) {
        alert(`Não foi possível salvar os dados da clínica: ${erro.message}`);
    }
}

async function salvarPerfilForm() {
    const perfil = {
        nome: document.getElementById('config-nome').value.trim(),
        crm: document.getElementById('config-crm').value.trim(),
        cargo: document.getElementById('config-cargo').value.trim(),
        email: document.getElementById('config-email').value.trim(),
    };

    try {
        await db.salvarPerfil(perfil);

        document.getElementById('config-preview-nome').textContent = perfil.nome;
        document.getElementById('config-preview-cargo').textContent = perfil.cargo;

        if (typeof window.atualizarTopbar === 'function') {
            window.atualizarTopbar();
        }

        const aviso = document.getElementById('config-salvo-aviso');
        if (aviso) {
            aviso.hidden = false;
            setTimeout(() => { aviso.hidden = true; }, 2000);
        }
    } catch (erro) {
        alert(`Não foi possível salvar o perfil: ${erro.message}`);
    }
}

// O modo escuro continua sendo preferência local do navegador, não um
// dado do banco — por isso ainda usa localStorage aqui, de propósito.
function aplicarModoEscuro(ativado) {
    document.documentElement.classList.toggle('dark-mode', ativado);
    localStorage.setItem('odontoai_dark_mode', ativado ? '1' : '0');
}