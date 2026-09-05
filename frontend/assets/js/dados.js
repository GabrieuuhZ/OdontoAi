// assets/js/dados.js
// "Banco de dados" local, guardado no localStorage do navegador.
// Quando a API de verdade existir, é só trocar as funções db.get*/db.salvar*
// por chamadas fetch() — o resto do código (telas) não muda.
//
// STATUS DA CONVERSÃO (Fase 3): pacientes, histórico de consultas, leitura
// de diagnósticos, agendamentos e dentistas já usam a API de verdade.
// O resto (chat, perfil, clínica, IA, e SALVAR diagnóstico) ainda usa
// localStorage — vamos convertendo aos poucos, tela por tela.

const API_BASE = 'http://localhost:3000/api';

async function chamarApi(caminho, opcoes = {}) {
    const resposta = await fetch(`${API_BASE}${caminho}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...opcoes,
    });

    const dados = await resposta.json().catch(() => null);

    if (!resposta.ok) {
        throw new Error(dados?.error || 'Erro ao comunicar com o servidor.');
    }

    return dados;
}

// Cada conversa tem um "dono" (paciente ou a recepcionista) e uma lista de mensagens.
const SEED_CONVERSAS = [
    {
        id: 1, nome: 'João Silva', papel: 'Paciente', avatarLetra: 'J', avatarCor: 'blue',
        mensagens: [
            { autor: 'outro', texto: 'Oi Dr. Carlos, posso confirmar minha consulta de amanhã?', hora: '10:20' },
            { autor: 'outro', texto: 'Confirmou a consulta de amanhã.', hora: '10:23' },
            { autor: 'eu', texto: 'Perfeito, João! Te espero às 09h.', hora: '10:25' },
        ],
    },
    {
        id: 2, nome: 'Maria Oliveira', papel: 'Paciente', avatarLetra: 'M', avatarCor: 'purple',
        mensagens: [
            { autor: 'outro', texto: 'Doutor, preciso remarcar minha consulta.', hora: '09:15' },
            { autor: 'eu', texto: 'Sem problemas, qual dia funciona melhor pra você?', hora: '09:20' },
        ],
    },
    {
        id: 3, nome: 'Ana Clara', papel: 'Paciente', avatarLetra: 'A', avatarCor: 'green',
        mensagens: [
            { autor: 'outro', texto: 'Obrigado pelo atendimento!', hora: 'Ontem' },
            { autor: 'eu', texto: 'Fico feliz que tenha gostado, Ana! Qualquer coisa é só chamar.', hora: 'Ontem' },
        ],
    },
    {
        id: 4, nome: 'Recepção (Camila)', papel: 'Recepcionista', avatarLetra: 'C', avatarCor: 'blue',
        mensagens: [
            { autor: 'outro', texto: 'Dr. Carlos, o paciente das 14h chegou mais cedo.', hora: '13:40' },
            { autor: 'eu', texto: 'Ok, pode encaminhar pra sala 2.', hora: '13:42' },
        ],
    },
];

const SEED_PERFIL = {
    nome: 'Dr. Carlos', crm: 'CRO-SP 45.678', email: 'carlos@odontoai.com', cargo: 'Cirurgião-Dentista',
};

const SEED_CLINICA = {
    nome: 'OdontoAI Clínica Odontológica',
    endereco: 'Av. Paulista, 1000 - São Paulo, SP - CEP 01310-100',
    telefone: '(11) 3000-0000',
};

// Só usado como fallback enquanto salvarDiagnosticoPaciente (a escrita)
// ainda não foi convertida pra API — a LEITURA já busca do banco de verdade.
const SEED_DIAGNOSTICOS = {};

const SEED_ANALISES = [];

// Lista de possíveis achados que a análise de IA (simulada) sorteia.
const ACHADOS_POSSIVEIS = [
    { dente: 'Dente 26', achado: 'Achado sugestivo de cárie oclusal', confianca: 78 },
    { dente: 'Dente 36', achado: 'Achado sugestivo de cárie interproximal', confianca: 71 },
    { dente: 'Dente 11', achado: 'Sem sinais sugestivos de cárie nesta imagem', confianca: 92 },
    { dente: 'Dente 38 (siso)', achado: 'Possível impactação do terceiro molar', confianca: 66 },
    { dente: 'Dente 48 (siso)', achado: 'Possível posicionamento horizontal do terceiro molar', confianca: 60 },
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
    // -------- Pacientes (API de verdade) --------
    async getPacientes() {
        return chamarApi('/pacientes');
    },
    async getPaciente(id) {
        return chamarApi(`/pacientes/${id}`);
    },
    async criarPaciente(dadosPaciente) {
        return chamarApi('/pacientes', { method: 'POST', body: JSON.stringify(dadosPaciente) });
    },
    async editarPaciente(id, dadosPaciente) {
        return chamarApi(`/pacientes/${id}`, { method: 'PUT', body: JSON.stringify(dadosPaciente) });
    },

    // -------- Dashboard (API de verdade) --------
        async getResumoDashboard(data) {
        return chamarApi(`/dashboard?data=${data}`);
    },

    // -------- Agendamentos (API de verdade) --------
    async getAgendamentos(data) {
        const dataAlvo = data || new Date().toISOString().slice(0, 10);
        return chamarApi(`/agendamentos?data=${dataAlvo}`);
    },
        async buscarAgendamentos(termo) {
        return chamarApi(`/agendamentos/buscar?termo=${encodeURIComponent(termo)}`);
    },
    async getResumoSemana(data) {
        return chamarApi(`/agendamentos/semana?data=${data}`);
    },
    async getHistoricoConsultas(pacienteId) {
        return chamarApi(`/agendamentos/paciente/${pacienteId}`);
    },
    async criarAgendamento(dadosAgendamento) {
        return chamarApi('/agendamentos', { method: 'POST', body: JSON.stringify(dadosAgendamento) });
    },
    async editarAgendamento(id, dadosAgendamento) {
        return chamarApi(`/agendamentos/${id}`, { method: 'PUT', body: JSON.stringify(dadosAgendamento) });
    },

    // -------- Dentistas (API de verdade) --------
    async getDentistas() {
        return chamarApi('/usuarios?papel=dentista');
    },

    // -------- Diagnósticos (leitura já é de verdade; escrita ainda não) --------
    async getDiagnosticosPaciente(pacienteId) {
        return chamarApi(`/diagnosticos/paciente/${pacienteId}`);
    },
    async salvarDiagnosticoPaciente(pacienteId, diagnostico) {
        return chamarApi('/diagnosticos', {
            method: 'POST',
            body: JSON.stringify({
                paciente_id: pacienteId,
                titulo: diagnostico.titulo,
                texto: diagnostico.texto,
                texto_original_ia: diagnostico.textoOriginalIA || null,
                diagnostico_dentista: diagnostico.diagnosticoDentista || null,
                gerado_por_ia: diagnostico.geradoPorIA ? 1 : 0,
            }),
        });
    },

    // -------- ANalise de IA --------
    async getAnalises() {
        return chamarApi('/analises-ia');
    },
    async criarAnalise(dadosAnalise) {
        return chamarApi('/analises-ia', { method: 'POST', body: JSON.stringify(dadosAnalise) });
    },


    // -------- Ainda em localStorage --------
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
    proximoId(lista) {
        return lista.length ? Math.max(...lista.map((item) => item.id)) + 1 : 1;
    },
};