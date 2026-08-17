// assets/js/cliente-detalhe.js
// Comportamento da tela "Ficha do Paciente": o botão Editar Cadastro abre
// um modal pré-preenchido com o que está na tela e, ao salvar, atualiza
// os campos exibidos. Chamado pelo roteador (index.js) ao entrar na página.
// Obs: por enquanto essa ficha não está ligada a um paciente específico da
// tabela de Clientes (é uma tela de exemplo) — quando ligarmos isso a uma
// API, o ideal é a ficha ser aberta por id (ex: cliente-detalhe.html?id=3).

function iniciarClienteDetalhe() {
    const btnEditar = document.getElementById('btn-editar-cadastro');
    if (btnEditar) {
        btnEditar.addEventListener('click', abrirModalCadastro);
    }
}

function abrirModalCadastro() {
    const nomeEl = document.getElementById('ficha-nome');
    const statusEl = document.getElementById('ficha-status');
    const cpfEl = document.getElementById('ficha-cpf');
    const nascimentoEl = document.getElementById('ficha-nascimento');
    const telefoneEl = document.getElementById('ficha-telefone');
    const emailEl = document.getElementById('ficha-email');
    const enderecoEl = document.getElementById('ficha-endereco');
    const convenioEl = document.getElementById('ficha-convenio');

    const statusAtual = statusEl.classList.contains('ativo') ? 'ativo' : 'inativo';

    const camposHtml = [
        campoForm({ label: 'Nome completo', name: 'nome', valor: nomeEl.textContent, obrigatorio: true }),
        campoForm({ label: 'CPF', name: 'cpf', valor: cpfEl.textContent }),
        campoForm({ label: 'Data de Nascimento', name: 'nascimento', valor: nascimentoEl.textContent }),
        campoForm({ label: 'Telefone', name: 'telefone', valor: telefoneEl.textContent }),
        campoForm({ label: 'Email', name: 'email', tipo: 'email', valor: emailEl.textContent }),
        campoForm({ label: 'Endereço', name: 'endereco', valor: enderecoEl.textContent }),
        campoForm({ label: 'Convênio', name: 'convenio', valor: convenioEl.textContent }),
        campoForm({
            label: 'Status', name: 'status', valor: statusAtual,
            opcoes: [{ valor: 'ativo', rotulo: 'Ativo' }, { valor: 'inativo', rotulo: 'Inativo' }],
        }),
    ].join('');

    abrirModal({
        titulo: 'Editar Cadastro',
        camposHtml,
        textoSalvar: 'Salvar alterações',
        aoSalvar(dados) {
            nomeEl.textContent = dados.nome;
            cpfEl.textContent = dados.cpf;
            nascimentoEl.textContent = dados.nascimento;
            telefoneEl.textContent = dados.telefone;
            emailEl.textContent = dados.email;
            enderecoEl.textContent = dados.endereco;
            convenioEl.textContent = dados.convenio;

            statusEl.textContent = dados.status === 'ativo' ? 'Ativo' : 'Inativo';
            statusEl.classList.remove('ativo', 'inativo');
            statusEl.classList.add(dados.status);
        },
    });
}
