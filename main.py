from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import asyncio
from datetime import datetime, date
import sqlite3
from contextlib import contextmanager
import json

app = FastAPI(
    title="Sistema de Recomendações de Saúde",
    description="API que cruza dados meteorológicos de Garanhuns com condições de saúde do usuário",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuração do banco de dados SQLite
DATABASE_URL = "health_system.db"

# Coordenadas de Garanhuns, PE
GARANHUNS_LAT = -8.89
GARANHUNS_LON = -36.49

# Modelos Pydantic
class Doenca(BaseModel):
    nome: str
    severidade: str  # leve, moderada, severa
    tipo: str  # respiratoria, cardiovascular, alergica, articular, dermatologica

class Alergia(BaseModel):
    nome: str
    tipo: str  # polen, poeira, umidade, temperatura

class Usuario(BaseModel):
    nome: str
    idade: int
    email: str
    doencas: List[Doenca]
    alergias: List[Alergia]

class UsuarioResponse(BaseModel):
    id: int
    nome: str
    idade: int
    email: str
    doencas: List[Doenca]
    alergias: List[Alergia]
    data_cadastro: str

class DadosClimaticos(BaseModel):
    temperatura_atual: float
    umidade: int
    velocidade_vento: float
    precipitacao: float
    pressao_atmosferica: float
    indice_uv: float
    visibilidade: float

class Recomendacao(BaseModel):
    tipo: str
    prioridade: str  # alta, media, baixa
    titulo: str
    descricao: str
    categoria: str  # medicacao, atividade, cuidados, alerta

class RecomendacaoResponse(BaseModel):
    usuario_id: int
    dados_climaticos: DadosClimaticos
    recomendacoes: List[Recomendacao]
    data_consulta: str

# Gerenciador de contexto para banco de dados
@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# Inicialização do banco de dados
def init_database():
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                idade INTEGER NOT NULL,
                email TEXT UNIQUE NOT NULL,
                data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.execute("""
            CREATE TABLE IF NOT EXISTS doencas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario_id INTEGER,
                nome TEXT NOT NULL,
                severidade TEXT NOT NULL,
                tipo TEXT NOT NULL,
                FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
            )
        """)
        
        conn.execute("""
            CREATE TABLE IF NOT EXISTS alergias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario_id INTEGER,
                nome TEXT NOT NULL,
                tipo TEXT NOT NULL,
                FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
            )
        """)
        
        conn.commit()

# Inicializar banco na inicialização da aplicação
@app.on_event("startup")
async def startup_event():
    init_database()

# Função para buscar dados meteorológicos do Open-Meteo
async def obter_dados_climaticos() -> DadosClimaticos:
    url = f"https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": GARANHUNS_LAT,
        "longitude": GARANHUNS_LON,
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,surface_pressure,uv_index,visibility",
        "timezone": "America/Recife"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            current = data["current"]
            
            return DadosClimaticos(
                temperatura_atual=current["temperature_2m"],
                umidade=current["relative_humidity_2m"],
                velocidade_vento=current["wind_speed_10m"],
                precipitacao=current["precipitation"],
                pressao_atmosferica=current["surface_pressure"],
                indice_uv=current["uv_index"],
                visibilidade=current["visibility"]
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao obter dados meteorológicos: {str(e)}")

# Sistema Especialista para gerar recomendações
class SistemaEspecialista:
    @staticmethod
    def gerar_recomendacoes(usuario: UsuarioResponse, clima: DadosClimaticos) -> List[Recomendacao]:
        recomendacoes = []
        
        # Recomendações baseadas na temperatura
        if clima.temperatura_atual > 30:
            recomendacoes.append(Recomendacao(
                tipo="temperatura_alta",
                prioridade="media",
                titulo="Temperatura elevada detectada",
                descricao="Mantenha-se hidratado, evite exposição solar prolongada e use roupas leves.",
                categoria="cuidados"
            ))
            
            # Recomendações específicas para doenças cardiovasculares
            for doenca in usuario.doencas:
                if doenca.tipo == "cardiovascular":
                    recomendacoes.append(Recomendacao(
                        tipo="cardiovascular_calor",
                        prioridade="alta",
                        titulo="Cuidado especial com doenças cardiovasculares",
                        descricao="O calor pode sobrecarregar o sistema cardiovascular. Evite atividades físicas intensas e monitore sua pressão.",
                        categoria="alerta"
                    ))
        
        if clima.temperatura_atual < 18:
            recomendacoes.append(Recomendacao(
                tipo="temperatura_baixa",
                prioridade="media",
                titulo="Temperatura baixa",
                descricao="Use roupas adequadas para se manter aquecido e proteja-se de correntes de ar.",
                categoria="cuidados"
            ))
        
        # Recomendações baseadas na umidade
        if clima.umidade > 80:
            for doenca in usuario.doencas:
                if doenca.tipo == "respiratoria":
                    recomendacoes.append(Recomendacao(
                        tipo="umidade_alta_respiratoria",
                        prioridade="alta",
                        titulo="Alta umidade - Cuidados respiratórios",
                        descricao="A alta umidade pode agravar problemas respiratórios. Mantenha ambientes ventilados e considere usar desumidificador.",
                        categoria="alerta"
                    ))
                elif doenca.tipo == "articular":
                    recomendacoes.append(Recomendacao(
                        tipo="umidade_articular",
                        prioridade="media",
                        titulo="Umidade e dores articulares",
                        descricao="A umidade elevada pode intensificar dores articulares. Mantenha-se aquecido e faça exercícios leves.",
                        categoria="cuidados"
                    ))
        
        # Recomendações baseadas no vento
        if clima.velocidade_vento > 20:
            for alergia in usuario.alergias:
                if alergia.tipo == "polen":
                    recomendacoes.append(Recomendacao(
                        tipo="vento_polen",
                        prioridade="alta",
                        titulo="Vento forte - Risco de alergia",
                        descricao="Ventos fortes podem aumentar a concentração de pólen no ar. Evite atividades ao ar livre e mantenha janelas fechadas.",
                        categoria="alerta"
                    ))
        
        # Recomendações baseadas na precipitação
        if clima.precipitacao > 0:
            for doenca in usuario.doencas:
                if doenca.tipo == "articular":
                    recomendacoes.append(Recomendacao(
                        tipo="chuva_articular",
                        prioridade="media",
                        titulo="Chuva e dores articulares",
                        descricao="Mudanças na pressão atmosférica devido à chuva podem afetar articulações. Mantenha-se aquecido e seco.",
                        categoria="cuidados"
                    ))
        
        # Recomendações baseadas no índice UV
        if clima.indice_uv > 6:
            for doenca in usuario.doencas:
                if doenca.tipo == "dermatologica":
                    recomendacoes.append(Recomendacao(
                        tipo="uv_alto_pele",
                        prioridade="alta",
                        titulo="Índice UV elevado - Proteção da pele",
                        descricao="Use protetor solar FPS 30+, roupas com proteção UV e evite exposição entre 10h-16h.",
                        categoria="alerta"
                    ))
        
        # Recomendações baseadas na pressão atmosférica
        if clima.pressao_atmosferica < 1010:
            for doenca in usuario.doencas:
                if doenca.tipo == "cardiovascular":
                    recomendacoes.append(Recomendacao(
                        tipo="pressao_baixa_cardio",
                        prioridade="media",
                        titulo="Pressão atmosférica baixa",
                        descricao="Mudanças na pressão podem afetar a circulação. Monitore sua pressão arterial e evite mudanças bruscas de posição.",
                        categoria="cuidados"
                    ))
        
        # Recomendações gerais baseadas na idade
        if usuario.idade > 65:
            recomendacoes.append(Recomendacao(
                tipo="idoso_geral",
                prioridade="media",
                titulo="Cuidados especiais para idosos",
                descricao="Monitore regularmente sua saúde, mantenha medicações em dia e tenha sempre contato de emergência disponível.",
                categoria="cuidados"
            ))
        
        return recomendacoes

# Endpoints da API

@app.post("/usuarios", response_model=dict)
async def cadastrar_usuario(usuario: Usuario):
    """Cadastra um novo usuário com suas condições de saúde"""
    with get_db_connection() as conn:
        try:
            # Inserir usuário
            cursor = conn.execute(
                "INSERT INTO usuarios (nome, idade, email) VALUES (?, ?, ?)",
                (usuario.nome, usuario.idade, usuario.email)
            )
            usuario_id = cursor.lastrowid
            
            # Inserir doenças
            for doenca in usuario.doencas:
                conn.execute(
                    "INSERT INTO doencas (usuario_id, nome, severidade, tipo) VALUES (?, ?, ?, ?)",
                    (usuario_id, doenca.nome, doenca.severidade, doenca.tipo)
                )
            
            # Inserir alergias
            for alergia in usuario.alergias:
                conn.execute(
                    "INSERT INTO alergias (usuario_id, nome, tipo) VALUES (?, ?, ?)",
                    (usuario_id, alergia.nome, alergia.tipo)
                )
            
            conn.commit()
            return {"message": f"Usuário cadastrado com sucesso! ID: {usuario_id}", "usuario_id": usuario_id}
            
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Email já cadastrado")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@app.get("/usuarios/{usuario_id}", response_model=UsuarioResponse)
async def obter_usuario(usuario_id: int):
    """Obtém dados completos de um usuário"""
    with get_db_connection() as conn:
        # Buscar usuário
        usuario_row = conn.execute(
            "SELECT * FROM usuarios WHERE id = ?", (usuario_id,)
        ).fetchone()
        
        if not usuario_row:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        # Buscar doenças
        doencas_rows = conn.execute(
            "SELECT nome, severidade, tipo FROM doencas WHERE usuario_id = ?", (usuario_id,)
        ).fetchall()
        
        # Buscar alergias
        alergias_rows = conn.execute(
            "SELECT nome, tipo FROM alergias WHERE usuario_id = ?", (usuario_id,)
        ).fetchall()
        
        return UsuarioResponse(
            id=usuario_row["id"],
            nome=usuario_row["nome"],
            idade=usuario_row["idade"],
            email=usuario_row["email"],
            doencas=[Doenca(nome=row["nome"], severidade=row["severidade"], tipo=row["tipo"]) for row in doencas_rows],
            alergias=[Alergia(nome=row["nome"], tipo=row["tipo"]) for row in alergias_rows],
            data_cadastro=usuario_row["data_cadastro"]
        )

@app.get("/clima", response_model=DadosClimaticos)
async def obter_clima():
    """Obtém dados meteorológicos atuais de Garanhuns"""
    return await obter_dados_climaticos()

@app.get("/usuarios/{usuario_id}/recomendacoes", response_model=RecomendacaoResponse)
async def obter_recomendacoes(usuario_id: int):
    """Obtém recomendações personalizadas baseadas no clima atual e condições de saúde do usuário"""
    # Obter dados do usuário
    usuario = await obter_usuario(usuario_id)
    
    # Obter dados climáticos
    clima = await obter_dados_climaticos()
    
    # Gerar recomendações usando o sistema especialista
    sistema = SistemaEspecialista()
    recomendacoes = sistema.gerar_recomendacoes(usuario, clima)
    
    return RecomendacaoResponse(
        usuario_id=usuario_id,
        dados_climaticos=clima,
        recomendacoes=recomendacoes,
        data_consulta=datetime.now().isoformat()
    )

@app.get("/usuarios", response_model=List[dict])
async def listar_usuarios():
    """Lista todos os usuários cadastrados"""
    with get_db_connection() as conn:
        usuarios = conn.execute(
            "SELECT id, nome, email, data_cadastro FROM usuarios ORDER BY data_cadastro DESC"
        ).fetchall()
        
        return [
            {
                "id": usuario["id"],
                "nome": usuario["nome"],
                "email": usuario["email"],
                "data_cadastro": usuario["data_cadastro"]
            }
            for usuario in usuarios
        ]

@app.delete("/usuarios/{usuario_id}")
async def deletar_usuario(usuario_id: int):
    """Remove um usuário e todos os dados associados"""
    with get_db_connection() as conn:
        # Verificar se usuário existe
        usuario = conn.execute("SELECT id FROM usuarios WHERE id = ?", (usuario_id,)).fetchone()
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        # Deletar dados relacionados
        conn.execute("DELETE FROM doencas WHERE usuario_id = ?", (usuario_id,))
        conn.execute("DELETE FROM alergias WHERE usuario_id = ?", (usuario_id,))
        conn.execute("DELETE FROM usuarios WHERE id = ?", (usuario_id,))
        
        conn.commit()
        return {"message": "Usuário removido com sucesso"}

@app.get("/")
async def root():
    """Endpoint raiz com informações da API"""
    return {
        "message": "Sistema de Recomendações de Saúde baseado no Clima",
        "version": "1.0.0",
        "cidade": "Garanhuns, PE",
        "endpoints": {
            "POST /usuarios": "Cadastrar novo usuário",
            "GET /usuarios/{id}": "Obter dados do usuário",
            "GET /usuarios/{id}/recomendacoes": "Obter recomendações personalizadas",
            "GET /clima": "Obter dados meteorológicos atuais",
            "GET /usuarios": "Listar todos os usuários"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)