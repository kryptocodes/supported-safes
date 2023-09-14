import TonWeb from 'tonweb'
import { sleep } from '../utils/general'

export class TonWallet {
	name: string = 'TON Wallet'
	logo: string = '/wallet_icons/ton.png'
	token: string = 'TON'
	provider: any
	tonReady: boolean = false
	address: string = ''

	constructor(isTestnet: boolean = false) {
		this.provider = null
		this.tonReady = false
	}

	checkTonReady = async (window: any) => {
		if (window.ton) {
			this.provider = window.ton
			this.tonReady = true
			console.log('TON ready')

			this.provider.on('accountsChanged', (accounts) => {
				console.log('TON accountsChanged', accounts)
				const account = accounts[0]
				this.address = account
			})
			await sleep(1000)
		}
	}

	connect = async () => {
		const accounts = await this.provider.send('ton_requestAccounts')
		const account = accounts[0]
		this.address = account
	}

	sendMoney = async (toAddress: string, amount: number, isTestnet: boolean = false, callback: any) => {
		try {
			await this.connect()
			await sleep(1000)
			if (this.tonReady) {
				const tonWeb = new TonWeb(isTestnet ? new TonWeb.HttpProvider('https://testnet.toncenter.com/api/v2/jsonRPC') : new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC'))
				const wallet = tonWeb.wallet.create({ address: this.address })
				console.log(wallet.methods.seqno)
				const lastTx = (await this.provider.getTransactions(this.address, 2))[0]

				console.log('TON lastTx', lastTx)
				const lastTxHash = lastTx.transaction_id.hash

				console.log('TON lastTxHash', lastTxHash)
				await sleep(1000)

				const result = await this.provider.send(
					'ton_sendTransaction',
					[{
						to: toAddress,
						value: TonWeb.utils.toNano(amount.toString()).toNumber(),
						data: 'questbook TON payout',
						dataType: 'text'
					}]
				)
				
				console.log('TON result', result)
				
				if (result) {
					await sleep(1000)
					// let interval = setInterval(async() => {
					// 	console.log('TON interval called');
					// 	// if(new Date().getTime() - startTime > 30000){
					// 	// 	clearInterval(interval);
					// 	// 	callback({error: 'Transaction timeout'})
					// 	// }

					// 	const seqno = await wallet.methods.seqno().call()
					// 	console.log('TON seqno', seqno)
					// 	if(seqno > prevSeqno) {
					// 		await sleep(1000)
					// 		const transactions = await tonWeb.getTransactions(this.address, 5, undefined, undefined, undefined)
					// 		console.log('TON transactions after transaction', transactions)
					// 		let transactionHash = ''
					// 		for(let i = 0; i < transactions.length; i++){
					// 			if(transactions[i]?.in_msg?.message === "questbook TON payout"){
					// 				transactionHash = transactions[i].transaction_id.hash
					// 				break
					// 			}
					// 		}
					// 		console.log({transactionHash})
					// 		clearInterval(interval);
					// 		callback({transactionHash})
					// 	}
					// }, 2000)
					let txHash = lastTxHash
					let tx = lastTx

					while (txHash == lastTxHash && tx?.in_msg?.message === "questbook TON payout") {
						await sleep(1500) // some delay between API calls
						tx = (await this.provider.getTransactions(this.address, 1,undefined, undefined, undefined))[0]
						txHash = tx.transaction_id.hash
					}
					console.log('TON txHash', txHash)
					callback({ transactionHash: txHash })

				} else {
					callback({ error: 'Transaction failed' })
				}
			} else {
				callback({ error: 'TON not ready' })
			}
		} catch (error) {
			console.log(error)
			callback({ error: error.message })
		}
	}
}
