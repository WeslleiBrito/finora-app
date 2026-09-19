import csv
from decimal import Decimal
from datetime import datetime

ARQUIVO = 'extrato_reforma.csv'

def carregar(caminho):
    linhas = []
    with open(caminho, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            r['valor'] = Decimal(r['valor'])
            r['datetime'] = datetime.fromisoformat(r['datetime'].replace('Z', '+00:00'))
            linhas.append(r)
    linhas.sort(key=lambda r: r['datetime'])  # ordem cronológica
    return linhas

def main(caminho):
    linhas = carregar(caminho)

    saldo = Decimal('0')
    rend_do_ciclo = Decimal('0')
    deposito_atual = None
    ciclos = []

    print("=" * 64)
    print("LINHA DO TEMPO (saldo corrente)")
    print("=" * 64)
    print(f"{'Data':<18}{'Evento':<12}{'Valor':>12}{'Saldo':>14}")

    for r in linhas:
        data = r['datetime'].strftime('%d/%m/%Y')
        valor = r['valor']
        tipo = r['tipo']

        if tipo == 'Dinheiro reservado':
            # fecha o ciclo anterior (depósito + rendimentos acumulados)
            if deposito_atual is not None:
                ciclos.append({
                    'data': deposito_atual['data'],
                    'deposito': deposito_atual['valor'],
                    'rendimentos': rend_do_ciclo,
                    'subtotal': deposito_atual['valor'] + rend_do_ciclo,
                })
            deposito_atual = {'data': data, 'valor': valor}
            rend_do_ciclo = Decimal('0')
            saldo += valor
            print(f"{data:<18}{'Depósito':<12}{valor:>12.2f}{saldo:>14.2f}")

        elif tipo == 'Rendimentos':
            rend_do_ciclo += valor
            saldo += valor
            print(f"{data:<18}{'Rendimento':<12}{valor:>12.2f}{saldo:>14.2f}")

        else:  # Dinheiro retirado (valor negativo)
            saldo += valor
            print(f"{data:<18}{'Retirada':<12}{valor:>12.2f}{saldo:>14.2f}")

    # fecha o último ciclo
    if deposito_atual is not None:
        ciclos.append({
            'data': deposito_atual['data'],
            'deposito': deposito_atual['valor'],
            'rendimentos': rend_do_ciclo,
            'subtotal': deposito_atual['valor'] + rend_do_ciclo,
        })

    # ---------- RESUMO POR CICLO ----------
    print()
    print("=" * 64)
    print("CICLOS: depósito + rendimentos até o próximo depósito")
    print("=" * 64)
    print(f"{'Depósito em':<18}{'Depósito':>12}{'Rendimentos':>14}{'Subtotal':>14}")

    tot_dep = Decimal('0')
    tot_rend = Decimal('0')
    for c in ciclos:
        print(f"{c['data']:<18}{c['deposito']:>12.2f}{c['rendimentos']:>14.2f}{c['subtotal']:>14.2f}")
        tot_dep += c['deposito']
        tot_rend += c['rendimentos']

    print("-" * 64)
    print(f"{'TOTAL':<18}{tot_dep:>12.2f}{tot_rend:>14.2f}{tot_dep + tot_rend:>14.2f}")
    print()
    print(f"Saldo final da caixinha: R$ {saldo:.2f}")

    # ---------- EXPORTA CSV DOS CICLOS ----------
    with open('ciclos_deposito.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['data_deposito', 'deposito', 'rendimentos_acumulados', 'subtotal'])
        for c in ciclos:
            w.writerow([c['data'], str(c['deposito']), str(c['rendimentos']), str(c['subtotal'])])
    print("✅ Resumo dos ciclos salvo em: ciclos_deposito.csv")

if __name__ == '__main__':
    import sys
    main(sys.argv[1] if len(sys.argv) > 1 else ARQUIVO)
