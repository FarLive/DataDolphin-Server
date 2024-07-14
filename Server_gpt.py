from flask import Flask
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
import requests
import os
from datetime import datetime, timedelta
from langchain_chroma.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings, OpenAI
from langchain.chains import RetrievalQA
from langchain_community.document_loaders import PyPDFLoader
import json
from flask import Flask, request, jsonify
import warnings

app = Flask(__name__)
CORS(app, resources={
    r"/query": {"origins": "http://localhost:3000"},
    r"/document_query": {"origins": "http://localhost:3000"}
}, supports_credentials=True)  # Añadir esta línea para habilitar CORS en toda la aplicación Flask
scheduler = BackgroundScheduler()

# Configuración de la API de OpenAI
openai_api_key= os.environ["OPENAI_API_KEY"] = ""  # Reemplaza con tu propia clave

# Ignorar específicamente las advertencias de deprecación de LangChain para el método `run`
warnings.filterwarnings("ignore", category=DeprecationWarning, module='langchain_core._api.deprecation', message="The method `Chain.run` was deprecated")

# Inicializamos ChromaDB
def initialize_chroma(persist_directory):
    embedding = OpenAIEmbeddings()
    vectordb = Chroma(persist_directory=persist_directory, embedding_function=embedding)
    return vectordb

persist_directory = 'db'
vectordb = initialize_chroma(persist_directory)

# Función para crear embeddings y guardarlos en ChromaDB
def embed_and_store_document(document_path, document_content, codigo):
    document_content = codigo + " " + document_content
    
    embedding = OpenAIEmbeddings()
    chunks = split_text(document_content, max_tokens=700)  # Reducir tamaño de fragmentos
    vectordb.add_texts(texts=chunks, metadatas=[{"source": document_path}] * len(chunks))

# Función para dividir el texto en partes más pequeñas
def split_text(text, max_tokens=500):  # Reducir tamaño de fragmentos
    words = text.split()
    chunks = []
    current_chunk = []
    current_length = 0
    
    for word in words:
        word_length = len(word) + 1  # Agregamos 1 por el espacio
        if current_length + word_length > max_tokens:
            chunks.append(' '.join(current_chunk))
            current_chunk = [word]
            current_length = word_length
        else:
            current_chunk.append(word)
            current_length += word_length
    
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks

# Función para generar resumen basado en embedding
def generate_summary(document_path):
    #print(f"\nDocument_path: {document_path}")

    retriever = vectordb.as_retriever(search_kwargs={"k": 1})

    # Suponemos que vectordb ya tiene los documentos y se recuperan los necesarios
    retrieved_docs = retriever.invoke(document_path)
    print(f"Retrieved docs: {retrieved_docs[0].metadata['source']}\n")

    if not retrieved_docs:
        return "No se encontró el documento."
    
    # Preparar el contenido del documento para el prompt
    document_content = " ".join([doc.page_content for doc in retrieved_docs])

    # Crear el payload para la solicitud
    data = {
        "model": "gpt-3.5-turbo",  # Asegúrate de que el modelo es correcto
        "messages": [
            {"role": "system", "content": "Tu sistema está configurado para generar resúmenes en español apartir del texto o documento que se te de, evita escribir la palabra resumen en el texto."},
            {"role": "user", "content": document_content}
        ]
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {openai_api_key}"
    }
    
    response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=data)
    
    if (response.status_code == 200):

        if "Resumen: " in response:
            response = response.replace("Resumen: ", "")

        response_data = response.json()
        return response_data['choices'][0]['message']['content'] if response_data['choices'] else "No se generó respuesta"
    else:
        return f"Error en la API de OpenAI: {response.status_code} - {response.text}"

# Función para realizar POST al endpoint
def post_summary(titulo, fecha, resumen, area):
    url = "http://localhost:4000/api/news/createNew"
    payload = {
        "titulo": titulo,
        "fecha": fecha,
        "resumen": resumen,
        "area": area
    }
    headers = {'Content-Type': 'application/json'}
    response = requests.post(url, data=json.dumps(payload), headers=headers)
    return response.status_code

# Funciones originales del script
def hacer_peticion_get(url, parametros=None):
    try:
        response = requests.get(url, params=parametros)
        response.raise_for_status()  # Lanza una excepción si la solicitud no es exitosa (código de estado diferente de 200)
        return response
    except requests.exceptions.RequestException as e:
        print("Error al realizar la solicitud GET:", e)
        return None

def consulta(url):
    response = hacer_peticion_get(url)
    if response is not None:
        if (response.status_code == 200):
            print("Solicitud exitosa")
            return response.json()
        else:
            print("La solicitud GET no fue exitosa. Código de estado:", response.status_code)

def obtener_listado_por_fecha(periodo):
    url = f"https://sidofqa.segob.gob.mx/dof/sidof/diarios/{periodo}"
    return consulta(url)

def obtener_documento(codigo_documento):
    url = f"https://sidofqa.segob.gob.mx/dof/sidof/documentos/pdf/{codigo_documento}"
    response = hacer_peticion_get(url)
    if response is not None:
        if (response.status_code == 200):
            contenido_pdf = response.content
            ruta_archivo = os.path.join("documents", f"{codigo_documento}.pdf")
            os.makedirs(os.path.dirname(ruta_archivo), exist_ok=True)
            with open(ruta_archivo, "wb") as archivo:
                archivo.write(contenido_pdf)
            print(f"Solicitud exitosa, DOF guardado como {ruta_archivo}")
            return ruta_archivo
        else:
            print("La solicitud GET no fue exitosa. Código de estado:", response.status_code)
    return None

# Función para clasificar el área del resumen
def classify_area(summary):
    prompt = (
        f"Clasifica el siguiente resumen en una de las siguientes áreas: 'Contraloría', 'Tesorería', 'Jurídica', 'Sistemas', 'Negocio/productos', 'Contabilidad'. El resumen es:\n\n{summary}\n\n"
        f"Responde solo con el nombre del área."
    )

    data = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": "Eres un asistente que clasifica resúmenes en áreas específicas."},
            {"role": "user", "content": prompt}
        ]
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {openai_api_key}"
    }

    response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=data)

    if response.status_code == 200:
        response_data = response.json()
        return response_data['choices'][0]['message']['content'].strip()
    else:
        return "Área desconocida"

# Modificar la función obtener_documentos para clasificar el área del resumen
def obtener_documentos(año, fecha_actual, periodo_consulta):
    diarios_periodo = obtener_listado_por_fecha(año)
    fecha_hace_7_dias = fecha_actual - timedelta(days=periodo_consulta)
    cod_diarios_semana_pasada = [
        (diario['codDiario'], diario['fecha']) for diario in diarios_periodo['ListaDiarios']
        if fecha_hace_7_dias <= datetime.strptime(diario['fecha'], '%d-%m-%Y') < fecha_actual
    ]
    print(f"Se publicaron {len(cod_diarios_semana_pasada)} DOFs la semana pasada", cod_diarios_semana_pasada, "\n")

    for codigo, fecha in cod_diarios_semana_pasada:
        document_path = obtener_documento(codigo)
        if document_path:
            loader = PyPDFLoader(document_path)
            pages = loader.load()
            content = []
            for page in pages:
                content.append(page.page_content)
            pdf_content = " ".join(content) 
            embed_and_store_document(document_path, pdf_content, str(codigo))

            summary = generate_summary(str(codigo) + " " + pdf_content)
            area = classify_area(summary)  # Clasificar el área del resumen
            post_summary(f"DOF {codigo}", fecha, summary, area)

    return "Documentos almacenados"
def scheduled_task():
    año_actual = datetime.now().strftime("%Y")
    periodo_consulta = 10
    fecha_actual = datetime.now()
    obtener_documentos(año_actual, fecha_actual, periodo_consulta)
    print("Tarea ejecutada")


# Definimos las funciones para el QA

## Definimos la cadena QA
def create_qa_chain():

    retriever = vectordb.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs={"score_threshold": 0.7}
    )
    qa_chain = RetrievalQA.from_chain_type(
        llm=OpenAI(),
        chain_type="stuff",
        retriever=retriever,
        return_source_documents=True
    )
    return qa_chain



## Definimos la función para la respuesta del modelo
def process_llm_response(llm_response):
    respuesta = llm_response["result"]
    sources = []
    if "source_documents" in llm_response:
        for source in llm_response["source_documents"]:
            sources.append(source.metadata['source'])
    return respuesta, sources


# Ruta para consultas generales
@app.route('/query', methods=['POST'])
def query_endpoint():
    query = request.json.get('query')
    if not query:
        return jsonify({"error": "No se proporcionó una consulta"}), 400

    qa_chain = create_qa_chain()
    llm_response = qa_chain.invoke(query)
    response, sources = process_llm_response(llm_response)

    return jsonify({"query": query, "response": response, "sources": sources})

# Ruta para consultas específicas y resumen de un documento
@app.route('/document_query', methods=['POST'])
def document_query_endpoint():
    data = request.json
    query = data.get('query')
    intro = data.get('intro')

    if not query or not intro:
        return 'No se proporcionó una consulta o nombre del documento'
    
    # Realizamos una consulta específica al documento seleccionado
    document_query = f" Usuario: {query} GPT: responde información específica sobre el documento que hable de {intro} del Diario oficial de la nación y responde en español siempre: "

    qa_chain = create_qa_chain()
    llm_response = qa_chain.invoke(document_query)

    response, sources = process_llm_response(llm_response)


    return jsonify({"query": query, "response": response, "sources": sources})


@app.route('/')
def home():
    return "Servidor Flask con tarea programada para ejecutar cada minuto"

if __name__ == "__main__":
    #scheduler.add_job(scheduled_task, 'interval', minutes=10, next_run_time=datetime.now())
    #scheduler.start()
    #try:
       app.run(debug=True, use_reloader=False)
    #finally:
    #    scheduler.shutdown()
