import json
import sys
import csv
from decimal import Decimal
from datetime import datetime
from collections import defaultdict

ARQUIVO_PADRAO = 'historico_reforma.json'

def parse_amount(amount):
    """Converte fraction + cents para Decimal."""
    return Decimal(amount.get('fraction', '0')) + Decimal(amount.get('cents', '0')) / 100

def carregar(caminho):
    with open(caminho, 'r', encoding='utf-8') as f:
        return json.load(f)

def main(caminho):
    dados = carregar(caminho)

    rendimentos = []
    depositos = []
    outros = []

    # Percorre todas as páginas, grupos e itens
    for pagina in dados:
        for grupo in pagina.get('groups', []):
            data_grupo = grupo.get('title', '')
            for item in grupo.get('items', []):
                titulo = item.get('title', '')
                valor = parse_amount(item.get('amount', {}))
                registro = {
                    'data_grupo': data_grupo,
                    'datetime': item.get('datetime', ''),
                    'titulo': titulo,
                    'valor': valor,
                    'movement_id': item.get('movement_id', ''),
                    'kind': item.get('metadata', {}).get('kind', ''),
                }

                if titulo == 'Rendimentos':
                    rendimentos.append(registro)
                elif titulo == 'Dinheiro reservado':
                    depositos.append(registro)
                else:
                    outros.append(registro)

    total_rendimentos = sum(r['valor'] for r in rendimentos)
    total_depositos = sum(d['valor'] for d in depositos)

    # RESUMO
    print("=" * 70)
    print("RESUMO DO EXTRATO")
    print("=" * 70)
    print(f"Arquivo analisado: {caminho}")
    print(f"Registros de Rendimentos: {len(rendimentos)}")
    print(f"Registros de Dinheiro reservado: {len(depositos)}")
    print(f"Outros lançamentos: {len(outros)}")
    print(f"Soma de Rendimentos: R$ {total_rendimentos:.2f}")
    print(f"Soma de Depósitos: R$ {total_depositos:.2f}")
    print("=" * 70)

    # LISTAGEM
    print("\n--- RENDIMENTOS ---")
    for r in rendimentos:
        print(f"{r['data_grupo']:25} | R$ {r['valor']:>8.2f} | {r['datetime']}")

    print("\n--- DINHEIRO RESERVADO ---")
    for d in depositos:
        print(f"{d['data_grupo']:25} | R$ {d['valor']:>8.2f} | {d['datetime']}")

    if outros:
        print("\n--- OUTROS LANÇAMENTOS ---")
        for o in outros:
            print(f"{o['data_grupo']:25} | {o['titulo']:25} | R$ {o['valor']:>8.2f}")

    # RENDIMENTOS POR MÊS
    rendimentos_por_mes = defaultdict(Decimal)
    for r in rendimentos:
        try:
            dt = datetime.fromisoformat(r['datetime'].replace('Z', '+00:00'))
            chave = dt.strftime('%Y-%m')
        except Exception:
            chave = 'data_invalida'
        rendimentos_por_mes[chave] += r['valor']

    print("\n--- RENDIMENTOS POR MÊS ---")
    for mes in sorted(rendimentos_por_mes):
        print(f"{mes}: R$ {rendimentos_por_mes[mes]:.2f}")

    # EXPORTA CSV
    csv_saida = 'extrato_reforma.csv'
    with open(csv_saida, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['tipo', 'data_grupo', 'datetime', 'valor', 'movement_id', 'titulo', 'kind'])
        for r in rendimentos:
            w.writerow(['Rendimentos', r['data_grupo'], r['datetime'], str(r['valor']), r['movement_id'], r['titulo'], r['kind']])
        for d in depositos:
            w.writerow(['Dinheiro reservado', d['data_grupo'], d['datetime'], str(d['valor']), d['movement_id'], d['titulo'], d['kind']])
        for o in outros:
            w.writerow(['Outro', o['data_grupo'], o['datetime'], str(o['valor']), o['movement_id'], o['titulo'], o['kind']])

    print(f"\n✅ CSV salvo em: {csv_saida}")

if __name__ == '__main__':
    caminho = sys.argv[1] if len(sys.argv) > 1 else ARQUIVO_PADRAO
    main(caminho)
