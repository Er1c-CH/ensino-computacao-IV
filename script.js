let doencas = [];
let alergias = [];
let currentUserId = null;
let currentUser = null;

// Estado da aplicação
let isLoggedIn = false;

// URL base da API
const API_BASE_URL = 'http://localhost:8000';

// Verificar se há login salvo
document.addEventListener('DOMContentLoaded', function() {
    const savedUserId = localStorage.getItem('climaVidaUserId');
    if (savedUserId) {
        currentUserId = parseInt(savedUserId);
        isLoggedIn = true;
        mostrarApp();
        carregarDadosUsuario();
    }
});

// Gerenciamento de Login/Cadastro
function switchLoginTab(tabName) {
    document.querySelectorAll('.login-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[onclick="switchLoginTab('${tabName}')"]`).classList.add('active');
    
    if (tabName === 'login') {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
    } else {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
    }
}

// Realizar login (buscar usuário existente)
async function realizarLogin() {
    const email = document.getElementById('loginEmail').value;

    if (!email) {
        showAlert('Por favor, informe o e-mail', 'error');
        return;
    }

    try {
        showLoading('Realizando login...');
        
        // Buscar todos os usuários para verificar se o e-mail existe
        const response = await fetch(`${API_BASE_URL}/usuarios`);
        if (!response.ok) {
            throw new Error('Erro ao conectar com o servidor');
        }
        
        const usuarios = await response.json();
        const usuario = usuarios.find(u => u.email === email);
        
        if (!usuario) {
            showAlert('Usuário não encontrado. Por favor, cadastre-se primeiro.', 'error');
            hideLoading();
            return;
        }

        // Buscar dados completos do usuário
        const userResponse = await fetch(`${API_BASE_URL}/usuarios/${usuario.id}`);
        if (!userResponse.ok) {
            throw new Error('Erro ao carregar dados do usuário');
        }

        currentUser = await userResponse.json();
        currentUserId = currentUser.id;
        isLoggedIn = true;
        
        localStorage.setItem('climaVidaUserId', currentUserId.toString());
        
        showAlert('Login realizado com sucesso!', 'success');
        hideLoading();
        
        setTimeout(() => {
            mostrarApp();
            carregarDadosUsuario();
        }, 1000);
        
    } catch (error) {
        console.error('Erro no login:', error);
        showAlert(`Erro no login: ${error.message}`, 'error');
        hideLoading();
    }
}

// Realizar cadastro
async function realizarCadastro() {
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const age = document.getElementById('registerAge').value;

    if (!name || !email || !age) {
        showAlert('Por favor, preencha todos os campos', 'error');
        return;
    }

    try {
        showLoading('Criando cadastro...');
        
        const novoUsuario = {
            nome: name,
            idade: parseInt(age),
            email: email,
            doencas: [],
            alergias: []
        };

        const response = await fetch(`${API_BASE_URL}/usuarios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(novoUsuario)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao criar usuário');
        }

        const result = await response.json();
        currentUserId = result.usuario_id;
        
        // Buscar dados completos do usuário recém-criado
        const userResponse = await fetch(`${API_BASE_URL}/usuarios/${currentUserId}`);
        currentUser = await userResponse.json();
        
        isLoggedIn = true;
        localStorage.setItem('climaVidaUserId', currentUserId.toString());

        showAlert('Cadastro realizado com sucesso!', 'success');
        hideLoading();
        
        setTimeout(() => {
            mostrarApp();
            carregarDadosUsuario();
        }, 1000);
        
    } catch (error) {
        console.error('Erro no cadastro:', error);
        showAlert(`Erro no cadastro: ${error.message}`, 'error');
        hideLoading();
    }
}

// Realizar logout
function realizarLogout() {
    localStorage.removeItem('climaVidaUserId');
    currentUser = null;
    currentUserId = null;
    isLoggedIn = false;
    doencas = [];
    alergias = [];
    
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appContent').classList.remove('active');
    
    // Limpar formulários
    document.getElementById('loginEmail').value = '';
    
    showAlert('Logout realizado com sucesso!', 'success');
}

// Mostrar aplicação principal
function mostrarApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContent').classList.add('active');
    carregarClima();
    gerarRecomendacoes();
}

// Carregar dados do usuário da API
async function carregarDadosUsuario() {
    if (!currentUserId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/usuarios/${currentUserId}`);
        if (!response.ok) {
            throw new Error('Erro ao carregar dados do usuário');
        }

        currentUser = await response.json();
        
        // Carregar dados básicos
        document.getElementById('nome').value = currentUser.nome || '';
        document.getElementById('idade').value = currentUser.idade || '';
        document.getElementById('email').value = currentUser.email || '';

        // Carregar doenças e alergias
        doencas = currentUser.doencas || [];
        alergias = currentUser.alergias || [];

        atualizarListaDoencas();
        atualizarListaAlergias();
        atualizarPerfilUsuario();
        
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        showAlert('Erro ao carregar dados do usuário', 'error');
    }
}

// Gerenciamento de Tabs
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');

    if (tabName === 'clima') {
        carregarClima();
    } else if (tabName === 'recomendacoes') {
        gerarRecomendacoes();
    }
}

// Adicionar doença
function adicionarDoenca() {
    const nome = document.getElementById('doencaNome').value;
    const tipo = document.getElementById('doencaTipo').value;
    const severidade = document.getElementById('doencaSeveridade').value;

    if (!nome.trim()) {
        showAlert('Por favor, informe o nome da doença', 'error');
        return;
    }

    const novaDoenca = {
        nome: nome.trim(),
        tipo,
        severidade
    };

    doencas.push(novaDoenca);
    atualizarListaDoencas();

    // Limpar campos
    document.getElementById('doencaNome').value = '';
    document.getElementById('doencaTipo').selectedIndex = 0;
    document.getElementById('doencaSeveridade').selectedIndex = 0;

    showAlert('Doença adicionada com sucesso!', 'success');
}

// Remover doença
function removerDoenca(index) {
    doencas.splice(index, 1);
    atualizarListaDoencas();
    showAlert('Doença removida!', 'success');
}

// Adicionar alergia
function adicionarAlergia() {
    const nome = document.getElementById('alergiaNome').value;
    const tipo = document.getElementById('alergiaTipo').value;

    if (!nome.trim()) {
        showAlert('Por favor, informe o nome da alergia', 'error');
        return;
    }

    const novaAlergia = {
        nome: nome.trim(),
        tipo
    };

    alergias.push(novaAlergia);
    atualizarListaAlergias();

    // Limpar campos
    document.getElementById('alergiaNome').value = '';
    document.getElementById('alergiaTipo').selectedIndex = 0;

    showAlert('Alergia adicionada com sucesso!', 'success');
}

// Remover alergia
function removerAlergia(index) {
    alergias.splice(index, 1);
    atualizarListaAlergias();
    showAlert('Alergia removida!', 'success');
}

// Atualizar lista de doenças
function atualizarListaDoencas() {
    const container = document.getElementById('doencasList');
    if (doencas.length === 0) {
        container.innerHTML = '<p style="color: #718096; font-style: italic;">Nenhuma doença cadastrada</p>';
        return;
    }

    container.innerHTML = doencas.map((doenca, index) => `
        <div class="disease-tag">
            ${doenca.nome} (${doenca.tipo} - ${doenca.severidade})
            <button onclick="removerDoenca(${index})" style="margin-left: 8px; background: none; border: none; color: #e53e3e; cursor: pointer; font-weight: bold;">×</button>
        </div>
    `).join('');
}

// Atualizar lista de alergias
function atualizarListaAlergias() {
    const container = document.getElementById('alergiasList');
    if (alergias.length === 0) {
        container.innerHTML = '<p style="color: #718096; font-style: italic;">Nenhuma alergia cadastrada</p>';
        return;
    }

    container.innerHTML = alergias.map((alergia, index) => `
        <div class="allergy-tag">
            ${alergia.nome} (${alergia.tipo})
            <button onclick="removerAlergia(${index})" style="margin-left: 8px; background: none; border: none; color: #e53e3e; cursor: pointer; font-weight: bold;">×</button>
        </div>
    `).join('');
}

// Atualizar perfil do usuário via API
async function atualizarPerfil() {
    const nome = document.getElementById('nome').value;
    const idade = document.getElementById('idade').value;
    const email = document.getElementById('email').value;

    if (!nome || !idade || !email) {
        showAlert('Por favor, preencha todos os campos obrigatórios', 'error');
        return;
    }

    try {
        showLoading('Atualizando perfil...');
        
        // Primeiro deletar o usuário atual
        await fetch(`${API_BASE_URL}/usuarios/${currentUserId}`, {
            method: 'DELETE'
        });

        // Criar novo usuário com dados atualizados
        const dadosAtualizados = {
            nome,
            idade: parseInt(idade),
            email,
            doencas,
            alergias
        };

        const response = await fetch(`${API_BASE_URL}/usuarios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dadosAtualizados)
        });

        if (!response.ok) {
            throw new Error('Erro ao atualizar perfil');
        }

        const result = await response.json();
        currentUserId = result.usuario_id;
        localStorage.setItem('climaVidaUserId', currentUserId.toString());

        // Recarregar dados do usuário
        await carregarDadosUsuario();
        
        hideLoading();
        showAlert('Perfil atualizado com sucesso!', 'success');
        
        // Regenerar recomendações
        gerarRecomendacoes();
        
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        showAlert('Erro ao atualizar perfil', 'error');
        hideLoading();
    }
}

// Atualizar perfil do usuário na interface
function atualizarPerfilUsuario() {
    if (!currentUser) return;

    document.getElementById('userAvatar').textContent = currentUser.nome.charAt(0).toUpperCase();
    document.getElementById('userName').textContent = currentUser.nome;
    document.getElementById('userInfo').textContent = `${currentUser.idade} anos • ${currentUser.email}`;

    // Mostrar condições
    const conditionsContainer = document.getElementById('userConditions');
    let conditionsHTML = '';

    if (doencas.length > 0) {
        conditionsHTML += doencas.map(d => `<span class="disease-tag">${d.nome}</span>`).join(' ');
    }

    if (alergias.length > 0) {
        conditionsHTML += alergias.map(a => `<span class="allergy-tag">${a.nome}</span>`).join(' ');
    }

    if (conditionsHTML === '') {
        conditionsHTML = '<span style="color: #718096; font-style: italic;">Nenhuma condição cadastrada</span>';
    }

    conditionsContainer.innerHTML = conditionsHTML;
}

// Carregar dados do clima da API
async function carregarClima() {
    const weatherContent = document.getElementById('weatherContent');
    
    try {
        showLoading('Carregando dados do clima...');
        
        const response = await fetch(`${API_BASE_URL}/clima`);
        if (!response.ok) {
            throw new Error('Erro ao carregar dados do clima');
        }
        
        const dadosClima = await response.json();
        
        hideLoading();
        
        weatherContent.innerHTML = `
            <div class="weather-grid">
                <div class="weather-item">
                    <div class="weather-value">${Math.round(dadosClima.temperatura_atual)}°C</div>
                    <div class="weather-label">Temperatura</div>
                </div>
                <div class="weather-item">
                    <div class="weather-value">${dadosClima.umidade}%</div>
                    <div class="weather-label">Umidade</div>
                </div>
                <div class="weather-item">
                    <div class="weather-value">${Math.round(dadosClima.pressao_atmosferica)} hPa</div>
                    <div class="weather-label">Pressão</div>
                </div>
                <div class="weather-item">
                    <div class="weather-value">${Math.round(dadosClima.velocidade_vento)} km/h</div>
                    <div class="weather-label">Vento</div>
                </div>
                <div class="weather-item">
                    <div class="weather-value">${Math.round(dadosClima.visibilidade)} km</div>
                    <div class="weather-label">Visibilidade</div>
                </div>
                <div class="weather-item">
                    <div class="weather-value">${Math.round(dadosClima.indice_uv)}</div>
                    <div class="weather-label">Índice UV</div>
                </div>
                <div class="weather-item">
                    <div class="weather-value">${Math.round(dadosClima.precipitacao)} mm</div>
                    <div class="weather-label">Precipitação</div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Erro ao carregar clima:', error);
        hideLoading();
        weatherContent.innerHTML = `
            <div style="text-align: center; color: #e53e3e; padding: 20px;">
                <p>Erro ao carregar dados do clima</p>
                <button onclick="carregarClima()" style="margin-top: 10px; padding: 8px 16px; background: #3182ce; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Tentar Novamente
                </button>
            </div>
        `;
    }
}

// Gerar recomendações da API
async function gerarRecomendacoes() {
    const recommendationsContent = document.getElementById('recommendationsContent');
    
    if (!currentUserId) {
        recommendationsContent.innerHTML = '<p>Faça login para ver recomendações personalizadas</p>';
        return;
    }
    
    try {
        showLoading('Gerando recomendações personalizadas...');
        
        const response = await fetch(`${API_BASE_URL}/usuarios/${currentUserId}/recomendacoes`);
        if (!response.ok) {
            throw new Error('Erro ao gerar recomendações');
        }
        
        const data = await response.json();
        const recomendacoes = data.recomendacoes;
        
        hideLoading();
        
        if (recomendacoes.length === 0) {
            recommendationsContent.innerHTML = `
                <div style="text-align: center; color: #718096; padding: 40px;">
                    <p>Nenhuma recomendação específica para as condições atuais.</p>
                    <p>Continue monitorando sua saúde!</p>
                </div>
            `;
            return;
        }
        
        // Renderizar recomendações
        recommendationsContent.innerHTML = recomendacoes.map(rec => `
            <div class="recommendation-item ${rec.prioridade}">
                <div class="priority-badge priority-${rec.prioridade}">
                    ${rec.prioridade === 'alta' ? 'Alta Prioridade' : 
                      rec.prioridade === 'media' ? 'Média Prioridade' : 'Baixa Prioridade'}
                </div>
                <div class="recommendation-title">${rec.titulo}</div>
                <div class="recommendation-desc">${rec.descricao}</div>
                <div style="margin-top: 8px; font-size: 12px; color: #718096;">
                    Categoria: ${rec.categoria} • Tipo: ${rec.tipo}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao gerar recomendações:', error);
        hideLoading();
        recommendationsContent.innerHTML = `
            <div style="text-align: center; color: #e53e3e; padding: 20px;">
                <p>Erro ao gerar recomendações</p>
                <button onclick="gerarRecomendacoes()" style="margin-top: 10px; padding: 8px 16px; background: #3182ce; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Tentar Novamente
                </button>
            </div>
        `;
    }
}

// Mostrar loading
function showLoading(message = 'Carregando...') {
    let loadingDiv = document.getElementById('loadingOverlay');
    if (!loadingDiv) {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'loadingOverlay';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            color: white;
            font-size: 18px;
        `;
        document.body.appendChild(loadingDiv);
    }
    loadingDiv.innerHTML = `<div style="text-align: center;"><div style="margin-bottom: 10px;">⏳</div>${message}</div>`;
    loadingDiv.style.display = 'flex';
}

// Esconder loading
function hideLoading() {
    const loadingDiv = document.getElementById('loadingOverlay');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
}

// Mostrar alertas
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alertContainer') || createAlertContainer();
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <strong>${type === 'success' ? 'Sucesso!' : 'Erro!'}</strong> ${message}
        <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
    `;
    
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

// Criar container de alertas se não existir
function createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alertContainer';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.maxWidth = '400px';
    document.body.appendChild(container);
    return container;
}

// Event listeners para Enter nos formulários
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const activeForm = document.querySelector('.login-form:not(.hidden)');
        if (activeForm) {
            if (activeForm.id === 'loginForm') {
                realizarLogin();
            } else if (activeForm.id === 'registerForm') {
                realizarCadastro();
            }
        }
    }
});

// Verificar status da API na inicialização
async function verificarAPI() {
    try {
        const response = await fetch(`${API_BASE_URL}/`);
        if (!response.ok) {
            throw new Error('API não disponível');
        }
        console.log('API conectada com sucesso');
    } catch (error) {
        console.error('Erro ao conectar com a API:', error);
        showAlert('Erro ao conectar com o servidor. Verifique se a API está rodando.', 'error');
    }
}

// Verificar API na inicialização
verificarAPI();