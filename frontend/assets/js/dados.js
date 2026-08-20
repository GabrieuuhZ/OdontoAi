// assets/js/dados.js
// "Banco de dados" local, guardado no localStorage do navegador.
// Começa com os mesmos registros que já existiam nas telas estáticas.
// Quando a API de verdade existir, é só trocar as funções db.get*/db.salvar*
// por chamadas fetch() — o resto do código (telas) não muda.

const SEED_PACIENTES = [
    { id: 1, nome: 'Maria Silva', cpf: '123.456.789-00', telefone: '(11) 98765-4321', email: 'maria.silva@email.com', nascimento: '14/03/1988', endereco: 'Rua das Flores, 123 - São Paulo, SP', convenio: 'Particular', ultimaConsulta: '18/06/2025', proximaConsulta: '25/06/2025', status: 'ativo' },
    { id: 2, nome: 'Pedro Oliveira', cpf: '234.567.890-11', telefone: '(11) 91234-5678', email: 'pedro.oliveira@email.com', nascimento: '02/07/1979', endereco: 'Av. Paulista, 900 - São Paulo, SP', convenio: 'OdontoPrev', ultimaConsulta: '17/06/2025', proximaConsulta: '—', status: 'ativo' },
    { id: 3, nome: 'Ana Costa', cpf: '345.678.901-22', telefone: '(11) 99876-5432', email: 'ana.costa@email.com', nascimento: '30/11/1995', endereco: 'Rua Augusta, 455 - São Paulo, SP', convenio: 'Particular', ultimaConsulta: '10/06/2025', proximaConsulta: '19/06/2025', status: 'ativo' },
    { id: 4, nome: 'Lucas Martins', cpf: '456.789.012-33', telefone: '(11) 98888-1122', email: 'lucas.martins@email.com', nascimento: '18/09/1990', endereco: 'Rua Oscar Freire, 210 - São Paulo, SP', convenio: 'Amil Dental', ultimaConsulta: '02/03/2025', proximaConsulta: '—', status: 'inativo' },
    { id: 5, nome: 'Juliana Santos', cpf: '567.890.123-44', telefone: '(11) 97777-3344', email: 'juliana.santos@email.com', nascimento: '25/05/2001', endereco: 'Rua Consolação, 780 - São Paulo, SP', convenio: 'Particular', ultimaConsulta: '15/06/2025', proximaConsulta: '19/06/2025', status: 'ativo' },
];

// Histórico de consultas por paciente (chave = id do paciente).
// Diferente de SEED_AGENDAMENTOS (que só tem os agendamentos de "hoje"),
// isso guarda o histórico ao longo do tempo, usado na Ficha do Paciente.
const SEED_HISTORICO_CONSULTAS = {
    1: [
        { data: '25/06/2025', dentista: 'Dr. Carlos', procedimento: 'Limpeza Dental', status: 'agendado' },
        { data: '18/06/2025', dentista: 'Dr. Carlos', procedimento: 'Limpeza Dental', status: 'concluido' },
        { data: '02/04/2025', dentista: 'Dra. Julia', procedimento: 'Restauração', status: 'concluido' },
        { data: '15/01/2025', dentista: 'Dr. Carlos', procedimento: 'Avaliação', status: 'faltou' },
    ],
    2: [
        { data: '17/06/2025', dentista: 'Dr. Carlos', procedimento: 'Clareamento', status: 'concluido' },
        { data: '20/03/2025', dentista: 'Dr. Carlos', procedimento: 'Avaliação', status: 'concluido' },
    ],
    3: [
        { data: '19/06/2025', dentista: 'Dra. Julia', procedimento: 'Restauração', status: 'agendado' },
        { data: '10/06/2025', dentista: 'Dra. Julia', procedimento: 'Restauração', status: 'concluido' },
        { data: '02/01/2025', dentista: 'Dra. Julia', procedimento: 'Limpeza Dental', status: 'concluido' },
    ],
    4: [
        { data: '02/03/2025', dentista: 'Dr. Carlos', procedimento: 'Avaliação', status: 'cancelado' },
    ],
    5: [
        { data: '19/06/2025', dentista: 'Dra. Julia', procedimento: 'Canal', status: 'agendado' },
        { data: '15/06/2025', dentista: 'Dra. Julia', procedimento: 'Canal', status: 'concluido' },
    ],
};

// Diagnósticos/observações "de exemplo" (a IA e os dentistas também podem
// adicionar mais, via db.salvarDiagnosticoPaciente — ficam somados a isso)
const SEED_DIAGNOSTICOS = {
    1: [
        { data: '18/06/2025', titulo: 'Limpeza de rotina', texto: 'Sem alterações. Recomendado retorno em 6 meses.' },
        { data: '02/04/2025', titulo: 'Restauração no dente 26', texto: 'Cárie tratada com resina composta. Sem intercorrências.' },
        { data: '10/01/2025', titulo: 'Avaliação inicial', texto: 'Paciente relatou sensibilidade no dente 26. Encaminhada para restauração.' },
    ],
};

const SEED_AGENDAMENTOS = [
    { id: 1, horario: '08:00', paciente: 'Maria Silva', dentista: 'Dr. Carlos', procedimento: 'Limpeza Dental', status: 'confirmado' },
    { id: 2, horario: '09:00', paciente: 'Pedro Oliveira', dentista: 'Dr. Carlos', procedimento: 'Clareamento', status: 'agendado' },
    { id: 3, horario: '10:30', paciente: 'Ana Costa', dentista: 'Dra. Julia', procedimento: 'Restauração', status: 'concluido' },
    { id: 4, horario: '11:30', paciente: 'Rafael Souza', dentista: 'Dra. Julia', procedimento: 'Avaliação', status: 'faltou' },
    { id: 5, horario: '14:00', paciente: 'Lucas Martins', dentista: 'Dr. Carlos', procedimento: 'Avaliação', status: 'confirmado' },
    { id: 6, horario: '15:30', paciente: 'Juliana Santos', dentista: 'Dra. Julia', procedimento: 'Canal', status: 'cancelado' },
];

// Cada conversa tem um "dono" (paciente ou a recepcionista) e uma lista de mensagens.
// autor: 'eu' = você (Dr. Carlos) mandou; 'outro' = a pessoa do outro lado mandou.
const SEED_CONVERSAS = [
    {
        id: 1,
        nome: 'João Silva',
        papel: 'Paciente',
        avatarLetra: 'J',
        avatarCor: 'blue',
        mensagens: [
            { autor: 'outro', texto: 'Oi Dr. Carlos, posso confirmar minha consulta de amanhã?', hora: '10:20' },
            { autor: 'outro', texto: 'Confirmou a consulta de amanhã.', hora: '10:23' },
            { autor: 'eu', texto: 'Perfeito, João! Te espero às 09h.', hora: '10:25' },
        ],
    },
    {
        id: 2,
        nome: 'Maria Oliveira',
        papel: 'Paciente',
        avatarLetra: 'M',
        avatarCor: 'purple',
        mensagens: [
            { autor: 'outro', texto: 'Doutor, preciso remarcar minha consulta.', hora: '09:15' },
            { autor: 'eu', texto: 'Sem problemas, qual dia funciona melhor pra você?', hora: '09:20' },
        ],
    },
    {
        id: 3,
        nome: 'Ana Clara',
        papel: 'Paciente',
        avatarLetra: 'A',
        avatarCor: 'green',
        mensagens: [
            { autor: 'outro', texto: 'Obrigado pelo atendimento!', hora: 'Ontem' },
            { autor: 'eu', texto: 'Fico feliz que tenha gostado, Ana! Qualquer coisa é só chamar.', hora: 'Ontem' },
        ],
    },
    {
        id: 4,
        nome: 'Recepção (Camila)',
        papel: 'Recepcionista',
        avatarLetra: 'C',
        avatarCor: 'blue',
        mensagens: [
            { autor: 'outro', texto: 'Dr. Carlos, o paciente das 14h chegou mais cedo.', hora: '13:40' },
            { autor: 'eu', texto: 'Ok, pode encaminhar pra sala 2.', hora: '13:42' },
        ],
    },
];

// Dados do perfil do dentista logado (nome, CRM/CRO, email de login)
const SEED_PERFIL = {
    nome: 'Dr. Carlos',
    crm: 'CRO-SP 45.678',
    email: 'carlos@odontoai.com',
    cargo: 'Cirurgião-Dentista',
};

// Dados da clínica, usados no cabeçalho de PDFs (receita, laudo de IA etc.)
const SEED_CLINICA = {
    nome: 'OdontoAI Clínica Odontológica',
    endereco: 'Av. Paulista, 1000 - São Paulo, SP - CEP 01310-100',
    telefone: '(11) 3000-0000',
};

// Histórico de análises de imagem feitas na aba IA. Começa vazio — vai
// enchendo conforme o usuário usa a tela (diferente dos outros SEEDs,
// que já vêm com dados de exemplo prontos).
const SEED_ANALISES = [];

// "Banco" de possíveis achados que a análise (simulada) pode sortear.
// Quando ligarmos numa IA de verdade, isso é substituído pela resposta real
// do modelo — o resto da tela (renderização, PDF, salvar na ficha) não muda.
// Lista de possíveis achados que a análise (simulada) sorteia.
// Reduzida às 3 categorias que o professor recomendou como MVP inicial:
// cárie, siso impactado e lesão periapical — em vez de tentar cobrir
// endodontia, periodontia, fraturas, cistos, tumores etc. de uma vez.
// Quando ligarmos numa IA de verdade, essa lista deixa de existir — o
// modelo real vai devolver os achados, no mesmo formato (dente, achado,
// confiança), então o resto da tela não precisa mudar.
//
// Cuidado de linguagem (também pedido pelo professor): sempre "achado
// sugestivo de..." ou "possível...", nunca afirmando o diagnóstico nem
// sugerindo a conduta (ex: nunca "necessita canal", sempre "sugestivo de
// lesão periapical, indicada avaliação").
const ACHADOS_POSSIVEIS = [
    // Cárie
    { dente: 'Dente 26', achado: 'Achado sugestivo de cárie oclusal', confianca: 78 },
    { dente: 'Dente 36', achado: 'Achado sugestivo de cárie interproximal', confianca: 71 },
    { dente: 'Dente 11', achado: 'Sem sinais sugestivos de cárie nesta imagem', confianca: 92 },
    // Siso impactado
    { dente: 'Dente 38 (siso)', achado: 'Possível impactação do terceiro molar', confianca: 66 },
    { dente: 'Dente 48 (siso)', achado: 'Possível posicionamento horizontal do terceiro molar', confianca: 60 },
    // Lesão periapical
    { dente: 'Dente 46', achado: 'Área radiolúcida sugestiva de lesão periapical', confianca: 58 },
    { dente: 'Dente 21', achado: 'Sem sinais sugestivos de lesão periapical nesta imagem', confianca: 89 },
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
    getConversas() {
        return carregar('odontoai_conversas', SEED_CONVERSAS);
    },
    salvarConversas(lista) {
        localStorage.setItem('odontoai_conversas', JSON.stringify(lista));
    },
    getPerfil() {
        return carregar('odontoai_perfil', SEED_PERFIL);
    },
    salvarPerfil(perfil) {
        localStorage.setItem('odontoai_perfil', JSON.stringify(perfil));
    },
    getClinica() {
        return carregar('odontoai_clinica', SEED_CLINICA);
    },
    salvarClinica(clinica) {
        localStorage.setItem('odontoai_clinica', JSON.stringify(clinica));
    },
    getAnalises() {
        return carregar('odontoai_analises_ia', SEED_ANALISES);
    },
    salvarAnalises(lista) {
        localStorage.setItem('odontoai_analises_ia', JSON.stringify(lista));
    },
    // Diagnósticos/observações por paciente, guardados como um "dicionário"
    // { [idDoPaciente]: [ {data, titulo, texto, geradoPorIA}, ... ] }
    // Obs: a tela "Ficha do Paciente" ainda é estática (não carrega por id
    // ainda — isso já está anotado em cliente-detalhe.js), então o que for
    // salvo aqui fica guardado certinho, mas só vai *aparecer* visualmente
    // na ficha quando aquela tela também passar a carregar dados por paciente.
    getDiagnosticosPaciente(pacienteId) {
        const todos = carregar('odontoai_diagnosticos', SEED_DIAGNOSTICOS);
        return todos[pacienteId] || [];
    },
    salvarDiagnosticoPaciente(pacienteId, diagnostico) {
        const todos = carregar('odontoai_diagnosticos', SEED_DIAGNOSTICOS);
        if (!todos[pacienteId]) todos[pacienteId] = [];
        todos[pacienteId].unshift(diagnostico);
        localStorage.setItem('odontoai_diagnosticos', JSON.stringify(todos));
    },
    getHistoricoConsultas(pacienteId) {
        const todos = carregar('odontoai_historico_consultas', SEED_HISTORICO_CONSULTAS);
        return todos[pacienteId] || [];
    },
    proximoId(lista) {
        return lista.length ? Math.max(...lista.map((item) => item.id)) + 1 : 1;
    },
};
