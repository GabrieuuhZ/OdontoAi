// assets/js/dados.js
// "Banco de dados" local, guardado no localStorage do navegador.
// Começa com os mesmos registros que já existiam nas telas estáticas.
// Quando a API de verdade existir, é só trocar as funções db.get*/db.salvar*
// por chamadas fetch() — o resto do código (telas) não muda.

const SEED_PACIENTES = [
    { id: 1, nome: 'Maria Silva', cpf: '123.456.789-00', telefone: '(11) 98765-4321', ultimaConsulta: '18/06/2025', proximaConsulta: '25/06/2025', status: 'ativo' },
    { id: 2, nome: 'Pedro Oliveira', cpf: '234.567.890-11', telefone: '(11) 91234-5678', ultimaConsulta: '17/06/2025', proximaConsulta: '—', status: 'ativo' },
    { id: 3, nome: 'Ana Costa', cpf: '345.678.901-22', telefone: '(11) 99876-5432', ultimaConsulta: '10/06/2025', proximaConsulta: '19/06/2025', status: 'ativo' },
    { id: 4, nome: 'Lucas Martins', cpf: '456.789.012-33', telefone: '(11) 98888-1122', ultimaConsulta: '02/03/2025', proximaConsulta: '—', status: 'inativo' },
    { id: 5, nome: 'Juliana Santos', cpf: '567.890.123-44', telefone: '(11) 97777-3344', ultimaConsulta: '15/06/2025', proximaConsulta: '19/06/2025', status: 'ativo' },
];

const SEED_AGENDAMENTOS = [
    { id: 1, horario: '08:00', paciente: 'Maria Silva', dentista: 'Dr. Carlos', procedimento: 'Limpeza Dental', status: 'confirmado' },
    { id: 2, horario: '09:00', paciente: 'Pedro Oliveira', dentista: 'Dr. Carlos', procedimento: 'Clareamento', status: 'agendado' },
    { id: 3, horario: '10:30', paciente: 'Ana Costa', dentista: 'Dra. Julia', procedimento: 'Restauração', status: 'concluido' },
    { id: 4, horario: '11:30', paciente: 'Rafael Souza', dentista: 'Dra. Julia', procedimento: 'Avaliação', status: 'faltou' },
    { id: 5, horario: '14:00', paciente: 'Lucas Martins', dentista: 'Dr. Carlos', procedimento: 'Avaliação', status: 'confirmado' },
    { id: 6, horario: '15:30', paciente: 'Juliana Santos', dentista: 'Dra. Julia', procedimento: 'Canal', status: 'cancelado' },
];

function carregar(chave, seed) {
    try {
        const bruto = localStorage.getItem(chave);
        if (!bruto) return seed;
        return JSON.parse(bruto);
    } catch (erro) {
        console.error('Não foi possível ler', chave, erro);
        return seed;
    }
}

const db = {
    getPacientes() {
        return carregar('odontoai_pacientes', SEED_PACIENTES);
    },
    salvarPacientes(lista) {
        localStorage.setItem('odontoai_pacientes', JSON.stringify(lista));
    },
    getAgendamentos() {
        return carregar('odontoai_agendamentos', SEED_AGENDAMENTOS);
    },
    salvarAgendamentos(lista) {
        localStorage.setItem('odontoai_agendamentos', JSON.stringify(lista));
    },
    proximoId(lista) {
        return lista.length ? Math.max(...lista.map((item) => item.id)) + 1 : 1;
    },
};
