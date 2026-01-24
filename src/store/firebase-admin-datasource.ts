import { CollectionChangeListener, Collections, DataSource, DocumentChangeListener, DocumentChangeListenerHandler, DocumentObject, QueryObject, QueryOperator, Unsubscriber } from 'entropic-bond'
import { FirebaseAdminHelper } from '../firebase-admin-helper'
import { Filter, WhereFilterOp } from 'firebase-admin/firestore'
import * as functions from 'firebase-functions/v2'

export class FirebaseAdminDatasource extends DataSource {

	override findById( id: string, collectionName: string ): Promise< DocumentObject > {
		const db = FirebaseAdminHelper.instance.firestore()
		
		return new Promise<DocumentObject>( async resolve => {
			try {
				const docSnap = db.doc( `${ collectionName }/${ id }`)
				const retrievedObj = await docSnap.get()
				resolve( retrievedObj.data() as DocumentObject )
			} 
			catch( error ) {
				console.log( error )
				return null
			}
		})
	}

	override save( collections: Collections ): Promise< void > {
		const db = FirebaseAdminHelper.instance.firestore()
		const batch = db.batch()

		Object.entries( collections ).forEach(([ collectionName, collection ]) => {
			collection?.forEach( document => {
					const ref = db.doc( `${ collectionName }/${ document.id }` )
					batch.set( ref, document ) 
			})
		})

		return batch.commit() as unknown as Promise<void>
	}

	override find( queryObject: QueryObject<DocumentObject>, collectionName: string ): Promise< DocumentObject[] > {
		const query = this.queryObjectToFirebaseQuery( queryObject, collectionName )

		this._lastQuery = query
		return this.getFromQuery( query )
	}

	override async count( queryObject: QueryObject<DocumentObject>, collectionName: string ): Promise<number> {
		const query = this.queryObjectToFirebaseQuery( queryObject, collectionName )
		const snapShot = await query.count().get()

		return snapShot.data().count
	}

	override delete( id: string, collectionName: string ): Promise< void > {
		const db = FirebaseAdminHelper.instance.firestore()

		return db.recursiveDelete( db.doc( `${ collectionName }/${ id }` ) )
	}

	override next( maxDocs?: number ): Promise< DocumentObject[] > {
		if( !this._lastQuery ) throw new Error('You should perform a query prior to using method next')

		this._lastLimit = maxDocs || this._lastLimit

		const query = this._lastQuery.limit( this._lastLimit ).startAfter( this._lastDocRetrieved )

		return this.getFromQuery( query )
	}

	// prev should be used with next in reverse order
	// prev( limit?: number ): Promise< DocumentObject[] > {
	// }

	private getFromQuery( query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> ): Promise<DocumentObject[]> {
		return new Promise< DocumentObject[] >( async resolve => {
			const doc = await query.get()
			this._lastDocRetrieved = doc.docs[ doc.docs.length-1 ]

			resolve( doc.docs.map( doc => doc.data() as DocumentObject ) ) 
		})
	}

	private queryObjectToFirebaseQuery( queryObject: QueryObject<DocumentObject>, collectionName: string ): FirebaseFirestore.Query<FirebaseFirestore.DocumentData> {
		const db = FirebaseAdminHelper.instance.firestore()

		const andConstraints: Filter[] = []
		const orConstraints: Filter[] = []

		DataSource.toPropertyPathOperations( queryObject.operations as any ).forEach( operation =>	{
			const operator = this.toFirebaseOperator( operation.operator )
			if ( operation.aggregate) orConstraints.push( Filter.where( operation.property, operator, operation.value ) )
			else andConstraints.push( Filter.where( operation.property, operator, operation.value ) )
		})

		let query = db.collection( collectionName ).where( Filter.or( ...orConstraints, Filter.and( ...andConstraints ) )) 

		if ( queryObject.sort?.propertyName ) {
			query = query.orderBy( queryObject.sort.propertyName, queryObject.sort.order ) 
		}

		if ( queryObject.limit ) {
			this._lastLimit = queryObject.limit
			query = query.limit( queryObject.limit )
		}

		return query
	}

	toFirebaseOperator( operator: QueryOperator ): WhereFilterOp {
		switch( operator ) {
			case '==': 
			case '!=':
			case '<':
			case '<=':
			case '>':
			case '>=': return operator
			case 'contains': return 'array-contains'
			case 'containsAny': return 'array-contains-any'
			default: return operator
		}
	}

	protected override subscribeToDocumentChangeListener( collectionPathToListen: string, listener: DocumentChangeListener<DocumentObject> ): Promise<DocumentChangeListenerHandler | undefined> {
		const handler = functions.firestore.onDocumentUpdated( collectionPathToListen + '/{docId}', event => {
			const snapshot = event.data
			listener({ 
				before: snapshot?.before.data() as DocumentObject, 
				after: snapshot?.after.data() as DocumentObject,
				type: 'update',
				params: event.params,
				collectionPath: collectionPathToListen
			})
		})
		
		return Promise.resolve({
			uninstall: () => {},
			nativeHandler: handler,
			collectionPath: collectionPathToListen
		})
	}

	protected override async collectionsMatchingTemplate( template: string ): Promise<string[]> {
		const templateTokens = template.split( '/' )
		if ( templateTokens.length != 3 ) throw new Error('FirebaseAdminDatasource.collectionsMatchingTemplate only supports collection and subcollection paths (max 3 tokens)')
		const [ mainCollection, _document, subcollection ] = templateTokens
		if ( !mainCollection || !subcollection ) throw new Error('FirebaseAdminDatasource.collectionsMatchingTemplate requires a document and subcollection')

		const db = FirebaseAdminHelper.instance.firestore()

		const docs = await db.collection( mainCollection ).get()

		const collectionList: string[] = []
		docs.docs.forEach(( doc ) => {
			collectionList.push( `${ mainCollection }/${ doc.id }/${ subcollection }` )
		})
		return collectionList
	}
	
	override onCollectionChange( query: QueryObject<DocumentObject>, collectionName: string, listener: CollectionChangeListener<DocumentObject> ): Unsubscriber {
		// const queryConstraints = this.queryObjectToQueryConstraints( query as unknown as QueryObject<DocumentObject>, collectionName )
		// return onSnapshot( queryConstraints, snapshot => {
		// 	snapshot.docChanges().forEach( change => {
		// 		listener({
		// 			type: change.type === 'added'? 'create' : change.type === 'modified'? 'update' : 'delete',
		// 			after: change.doc.data() as DocumentObject,
		// 			before: undefined,
		// 			params: {}
		// 		})
		// 	})
		// })
		throw new Error( 'Not implemented yet')
	}

	override onDocumentChange( documentPath: string, documentId: string, listener: DocumentChangeListener<DocumentObject> ): Unsubscriber {
		// const db = FirebaseHelper.instance.firestore()

		// return onSnapshot( doc( db, documentPath, documentId ), snapshot => {
		// 	listener({
		// 		type: 'update',
		// 		before: undefined,
		// 		after: snapshot.data() as DocumentObject,
		// 		params: {}
		// 	})

		// })
		throw new Error( 'Not implemented yet')
	}
	

	private _lastQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> | undefined
	private _lastLimit: number = 0
	private _lastDocRetrieved: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | undefined
}