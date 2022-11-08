import {
	createInstructionData,
	getAllTokenOwnerRecords,
	getGovernanceAccounts,
	getNativeTreasuryAddress,
	getRealm,
	Governance,
	InstructionData,
	ProgramAccount,
	Proposal,
	pubkeyFilter,
	TokenOwnerRecord,
	VoteType,
	withCreateProposal,
	withInsertTransaction,
	withSignOffProposal,
} from '@solana/spl-governance';
import { Connection, GetProgramAccountsConfig, GetProgramAccountsFilter, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
// import {Token} from '@solana/spl-token';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { TokenListProvider } from '@solana/spl-token-registry'
import assert from 'assert';
import axios from 'axios';
import { getDateInDDMMYYYY, solanaToUsd, usdToSolana } from './tokenConversionUtils';

export class realms{

	chainId: number;
	rpcURL: string;
	safeAddress: PublicKey | undefined;
	connection: Connection;
	programId: PublicKey;
	allProposals: ProgramAccount<Proposal>[];

	constructor(chainId: number, rpcURL: string, safeAddress: string) {
		this.chainId = chainId;
		this.rpcURL = rpcURL;
		this.safeAddress = safeAddress? new PublicKey(safeAddress): undefined;
		this.connection = new Connection(rpcURL);
		this.programId = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw');
		this.allProposals = [];
	}

    isValidRecipientAddress(address: String): Promise<boolean> {
		return new Promise((resolve, reject) => {
			try {
				resolve(PublicKey.isOnCurve(new PublicKey(address).toBuffer()));
			}
			catch(e){
				resolve(false);
			}
		})
	}

	createMultiTransaction(transactions: any[], safeAddress: string): void {
    	throw new Error('Method not implemented.')
	}

	async solTokenTrxn (
		transactions: any, 
		nativeTreasury: any, 
		proposalInstructions: any, 
		governance: any, 
		proposalAddress: any,
		tokenOwnerRecord:any ,
		payer: any): Promise<any>{

		for(let i = 0; i < transactions.length; i++) {
			// logger.info({ txAmount: transactions[i].amount}, 'txAmount')
			const solanaAmount = await usdToSolana(transactions[i].amount)
			// logger.info({solAmount: solanaAmount}, 'Solana amount')
			const obj = {
    			fromPubkey: nativeTreasury,
    			toPubkey: new PublicKey(transactions[i].to),
    			lamports: Math.floor(solanaAmount * 10**9),
    			programId: this.programId,
    		}
    		const ins = SystemProgram.transfer(obj)

			// logger.info({obj}, 'INS object')

    		const instructionData = createInstructionData(ins)

    		await withInsertTransaction(
    			proposalInstructions,
    			this.programId,
    			2,
    			governance.pubkey,
    			proposalAddress,
    			tokenOwnerRecord[0].pubkey,
				payer!,
				i,
				0,
				0,
				[instructionData],
				payer!
    		)
    	}

    	withSignOffProposal(
    		proposalInstructions,
    		this.programId,
    		2,
    		this.safeAddress!,
    		governance.pubkey,
    		proposalAddress,
            payer!,
            undefined,
            tokenOwnerRecord[0].pubkey
    	)

    	const getProvider = (): any => {
    		if('solana' in window) {
    			// @ts-ignore
    			const provider = window.solana as any
    			if(provider.isPhantom) {
    				return provider as any
    			}
    		}
    	}

    	console.log('create New proposal - getProvider', getProvider())

    	const block = await this.connection.getLatestBlockhash('confirmed')
    	const transaction = new Transaction()
    	transaction.recentBlockhash = block.blockhash
    	transaction.feePayer = payer!
    	transaction.add(...proposalInstructions)
    	await getProvider().signAndSendTransaction(transaction)
	}

	async splTokenTrxn(
		wallet: any,
		transactions: any, 
		nativeTreasury: any, 
		proposalInstructions: any, 
		governance: any, 
		proposalAddress: any,
		tokenOwnerRecord:any ,
		payer: any): Promise<any>{
			const accountCreationInstruction: TransactionInstruction[] = []

			for(let i = 0; i < transactions.length; i++) {
				const mintPublicKey = new PublicKey(transactions[i]?.selectedToken.info.mint);  
				// const mintToken = new Token(
				// 	this.connection,
				// 	mintPublicKey,
				// 	TOKEN_PROGRAM_ID,
				// 	wallet// the wallet owner will pay to transfer and to create recipients associated token account if it does not yet exist.
				// );

				const [fromAddress] = await PublicKey.findProgramAddress(
					[nativeTreasury.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintPublicKey.toBuffer()],
					ASSOCIATED_TOKEN_PROGRAM_ID
				);
		
				const [toAddress] = await PublicKey.findProgramAddress(
					[new PublicKey(transactions[i].to).toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintPublicKey.toBuffer()],
					ASSOCIATED_TOKEN_PROGRAM_ID
				);

				const receiverAccount = await this.connection.getAccountInfo(toAddress);

				// if (receiverAccount === null) {
				// 	accountCreationInstruction.push(
				// 			Token.createAssociatedTokenAccountInstruction(
				// 				mintToken.associatedProgramId,
				// 				mintToken.programId,
				// 				mintPublicKey,
				// 				toAddress,
				// 				new PublicKey(transactions[i].to),
				// 				wallet.publicKey
				// 			)
				// 	)
				// }

				const instructions: InstructionData[] = []; 

				// instructions.push(
				// 	createInstructionData(
				// 		Token.createTransferInstruction(
				// 			TOKEN_PROGRAM_ID,
				// 			fromAddress,
				// 			toAddress,
				// 			nativeTreasury,
				// 			[],
				// 			transactions[i].amount*10**transactions[0]?.selectedToken.info.tokenAmount.decimals
				// 		)
				// 	)
				// );
	
				await withInsertTransaction(
					proposalInstructions,
					this.programId,
					2,
					governance.pubkey,
					proposalAddress,
					tokenOwnerRecord[0].pubkey,
					payer!,
					i,
					0,
					0,
					instructions,
					payer!
				)
			}
	
			withSignOffProposal(
				proposalInstructions,
				this.programId,
				2,
				this.safeAddress!,
				governance.pubkey,
				proposalAddress,
				payer!,
				undefined,
				tokenOwnerRecord[0].pubkey
			)
	
			const getProvider = (): any => {
				if('solana' in window) {
					// @ts-ignore
					const provider = window.solana as any
					if(provider.isPhantom) {
						return provider as any
					}
				}
			}
	
			console.log('create New proposal - getProvider', getProvider())
	
			const block = await this.connection.getLatestBlockhash('confirmed')
			const transaction = new Transaction()
			transaction.recentBlockhash = block.blockhash
			transaction.feePayer = payer!
			if(accountCreationInstruction.length>0) {
				transaction.add(...accountCreationInstruction)
			}
			transaction.add(...proposalInstructions)
			await getProvider().signAndSendTransaction(transaction)
	}


	async proposeTransactions(grantname: string, transactions: any[], wallet: any): Promise<string> {

		console.log('transactions', transactions)

    	const realmData = await getRealm(this.connection, this.safeAddress!)
    	const governances = await getGovernanceAccounts(this.connection, this.programId, Governance, [
			pubkeyFilter(1, this.safeAddress)!,
		])

		const governance = governances.filter((gov)=>gov.pubkey.toString()===realmData.account.authority?.toString())[0]
    	const payer : PublicKey = wallet.publicKey

    	const tokenOwnerRecord  = await getGovernanceAccounts(
			this.connection,
			this.programId,
			TokenOwnerRecord,
			[pubkeyFilter(1, realmData.pubkey)!, pubkeyFilter(65, payer)!]
		  );
		  
    	const proposalInstructions: TransactionInstruction[] = []

    	const proposalAddress = await withCreateProposal(
    		proposalInstructions,
    		this.programId,
    		2,
    		this.safeAddress!,
    		governance.pubkey,
    		tokenOwnerRecord[0].pubkey,
    		`${transactions.length > 1 ? 'Batched Payout - ' : ''} ${grantname} - ${new Date().toDateString()}`,
    		`${grantname}`,
    		tokenOwnerRecord[0].account.governingTokenMint,
            payer!,
            governance.account.proposalCount,
            VoteType.SINGLE_CHOICE,
            ['Approve'],
            true,
            payer!
    	)

    	const nativeTreasury = await getNativeTreasuryAddress(this.programId, governance.pubkey)

		if(transactions[0].selectedToken.name==="SOL"){
			await this.solTokenTrxn(
				transactions, 
				nativeTreasury, 
				proposalInstructions, 
				governance, 
				proposalAddress,
				tokenOwnerRecord,
				payer)
    	}else{
			await this.splTokenTrxn(
				wallet,
				transactions, 
				nativeTreasury, 
				proposalInstructions, 
				governance, 
				proposalAddress,
				tokenOwnerRecord,
				payer)
		}

    	return proposalAddress.toString()
	}

	isValidSafeAddress(realmsPublicKey: string): any {
    	//safe address => realms public key

    	return false
	}

	async isOwner(address: String): Promise<boolean> {
    	const tokenownerrecord = await getAllTokenOwnerRecords(this.connection, this.programId, this.safeAddress!)
    	let isOwner = false
    	for(let i = 0; i < tokenownerrecord.length; i++) {
    		if(tokenownerrecord[i].account.governingTokenOwner.toString() === address) {
    			isOwner = true
    			break
    		}
    	}

    	return isOwner
	}

	async getSafeDetails(realmsPublicKey: String): Promise<any> {
    	const realmData = await getRealm(this.connection, new PublicKey(realmsPublicKey))
    	const COUNCIL_MINT = realmData.account.config.councilMint
    	await getGovernanceAccounts(this.connection, this.programId, Governance, [pubkeyFilter(33, COUNCIL_MINT)!])
	}

	async initialiseAllProposals(): Promise<any>{
		const realmData = await getRealm(this.connection, new PublicKey(this.safeAddress!))
    	const governances = await getGovernanceAccounts(this.connection, this.programId, Governance, [
			pubkeyFilter(1, this.safeAddress)!,
		])
		const governance = governances.filter((gov)=>gov.pubkey.toString()===realmData.account.authority?.toString())[0]

    	const proposals = await getGovernanceAccounts(this.connection, new PublicKey(this.programId), Proposal, [
                    pubkeyFilter(1, governance.pubkey)!,
    	])

		this.allProposals = proposals;
	}

	async getTransactionHashStatus(proposalPublicKey: string): Promise<any> {
    
    	const propsalsToSend: {[proposalKey: string]: {status: number, closedAtDate: string}} = {};

    	(this.allProposals
    		?.filter((proposal) => proposalPublicKey.includes(proposal.pubkey.toString())) || [])
    		.map((proposal) => {
				let closedAtDate = ''
				if(proposal.account.state===5){
					const closedAt = new Date((Number(proposal?.account?.closedAt?.toString()||''))*1000);
					closedAtDate = getDateInDDMMYYYY(closedAt);
				}
				
    			propsalsToSend[proposal.pubkey.toString()] = {status:proposal.account.state < 5 ? 0 : proposal.account.state === 5 ? 1 : 2, 
					closedAtDate}
    		})
    	return propsalsToSend
	}

	getNextSteps(): string[] {
		return ['Open the transaction on Realms', 'Sign the newly created proposal', 'Ask all the multi-sig signers to sign the proposal']
	}

	// getSafeDetails = async(realmsAddress: string): Promise<SafeSelectOption | null> => {
	// 	const tokenListAndBalance = await getTokenAndbalance(realmsAddress);
	// 	let usdAmount = 0;
	// 	tokenListAndBalance.map((obj:any)=>{
	// 		usdAmount += obj.usdValueAmount
	// 	})
	// 	return {
	// 		safeAddress: realmsAddress,
	// 		networkType: NetworkType.Solana,
	// 		networkId: '900001', // A costum value for Solana as it's not EVM.
	// 		networkName: 'Solana',
	// 		networkIcon: '/network_icons/solana.svg',
	// 		safeType: 'Realms',
	// 		safeIcon: '/safes_icons/realms.svg',
	// 		amount: usdAmount, // 1000
	// 		isDisabled: usdAmount < USD_THRESHOLD
	// 	}
	// }

	async getOwners (): Promise<string[]> {
		const connection = new Connection(process.env.SOLANA_RPC!, 'recent')
		const programId = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw')

		try {
			const safeAddressPublicKey = new PublicKey(this.safeAddress!)
			const tokenownerrecord = await getAllTokenOwnerRecords(connection, programId, safeAddressPublicKey)
			return tokenownerrecord.map(record => record.account.governingTokenOwner.toString())
		} catch(e: any) {
			return []
		}
	}

	async getTokenAndbalance (): Promise<any>{

		let tokenList:any[] = [];

		const connection = new Connection(process.env.SOLANA_RPC!, 'recent')
		const programId = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw')
		const realmsPublicKey = new PublicKey(this.safeAddress!)
		const realmData = await getRealm(connection, realmsPublicKey)
		const governances = await getGovernanceAccounts(connection, programId, Governance, [
			pubkeyFilter(1, new PublicKey(this.safeAddress!))!,
		])
		const governance = governances.filter((gov)=>gov.pubkey.toString()===realmData.account.authority?.toString())[0]
		const nativeTreasuryAddress = await getNativeTreasuryAddress(programId, governance.pubkey)
		// assert(realmData.account.name)
		const solAmount = (await connection.getAccountInfo(nativeTreasuryAddress))!.lamports / 1000000000
		const usdAmount = await solanaToUsd(solAmount)

		tokenList.push( {
			tokenIcon: '/network_icons/solana.svg',
			tokenName: 'SOL',
			tokenValueAmount: solAmount,
			usdValueAmount: usdAmount, 
			mintAddress: nativeTreasuryAddress,
			info: undefined,
		})

		const filters:GetProgramAccountsFilter[] = [
			{
			dataSize: 165,    //size of account (bytes)
			},
			{
			memcmp: {
				offset: 32,     //location of our query in the account (bytes)
				bytes: nativeTreasuryAddress.toString(),  //our search criteria, a base58 encoded string
			}            
			}
		];
		const treasuryAccInfo = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {filters:filters})

		const allTokens = await new TokenListProvider().resolve()
		const allTokenList = allTokens.filterByClusterSlug('mainnet-beta').getList()
		
		await Promise.all(treasuryAccInfo.map(async (info: any)=>{
				const tokenInfo = info.account.data?.parsed?.info;
				const tokenCoinGeckoInfo = allTokenList.find((x)=>x.address===tokenInfo?.mint)
				// console.log('tokenListAndBalance - tokenCoinGeckoInfo', tokenCoinGeckoInfo)
				const tokenUsdValue = await axios.get(
					`https://api.coingecko.com/api/v3/simple/price?ids=${tokenCoinGeckoInfo?.extensions?.coingeckoId}&vs_currencies=usd`
				)
				
				// console.log('tokenListAndBalance - tokenUsdValue', tokenUsdValue?.data[tokenCoinGeckoInfo.extensions?.coingeckoId])
				if(tokenInfo?.mint && tokenCoinGeckoInfo && tokenUsdValue?.data){
					tokenList.push( {
						tokenIcon: tokenCoinGeckoInfo.logoURI,
						tokenName: tokenCoinGeckoInfo.name,
						symbol: tokenCoinGeckoInfo.name, 
						tokenValueAmount: tokenInfo?.tokenAmount?.uiAmount,
						usdValueAmount: tokenInfo?.tokenAmount?.uiAmount * tokenUsdValue?.data[tokenCoinGeckoInfo.extensions?.coingeckoId!]?.usd, 
						mintAddress: tokenInfo?.mint,
						info: tokenInfo,
					})	
				}
			}))
		

		return tokenList;

	}

}
