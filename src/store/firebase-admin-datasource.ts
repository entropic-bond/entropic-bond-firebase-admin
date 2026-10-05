import { CollectionChangeListener, Collections, DataSource, DocumentChange, DocumentChangeListener, DocumentObject, QueryCursor, QueryObject, QueryOperator, TransactionConflictError, TransactionHandle, Unsubscriber } from 'entropic-bond'
import { FirebaseAdminHelper } from '../firebase-admin-helper'
import { DocumentSnapshot, Filter, WhereFilterOp } from 'firebase-admin/firestore'
import * as functions from 'firebase-functions/v2'
import { FirestoreEvent } from 'firebase-functions/firestore'

/**
 * Paginates a Firebase query server-side. It owns the base query, the page size
 * and the last retrieved snapshot, so pagination state is local to the query
 * that produced the cursor instead of being shared across the data source.
 */
export class FirebaseAdminQueryCursor extends QueryCursor {

	constructor(
		private _baseQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>,
		private _pageSize: number,
	) {
		super([])
	}

	override async next( limit?: number ): Promise< DocumentObject[] > {
		if ( limit !== undefined ) this._pageSize = limit
		if ( this._exhausted ) return []

		let query = this._baseQuery
		if ( this._lastSnapshot ) query = query.startAfter( this._lastSnapshot )
		if ( this._pageSize > 0 ) query = query.limit( this._pageSize )

		const snapshot = await query.get()

		if ( snapshot.empty ) {
			this._exhausted = true
			return []
		}

		this._lastSnapshot = snapshot.docs[ snapshot.docs.length - 1 ]
		return snapshot.docs.map( doc => doc.data() as DocumentObject )
	}

	private _lastSnapshot: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | undefined
	private _exhausted: boolean = false
}

export class FirebaseAdminDatasource extends DataSource {

	constructor( firebaseFunctionsGlobalOptions?: functions.GlobalOptions ) {
		super()
		if ( firebaseFunctionsGlobalOptions )	functions.setGlobalOptions( firebaseFunctionsGlobalOptions )
	}

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

	override find( queryObject: QueryObject<DocumentObject>, collectionName: string ): Promise< QueryCursor > {
		const query = this.queryObjectToFirebaseQuery( queryObject, collectionName )

		return Promise.resolve( new FirebaseAdminQueryCursor( query, queryObject.limit || 0 ) )
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

	override async runTransaction<Result>( fn: ( handle: TransactionHandle ) => Promise<Result> ): Promise<Result> {
		const db = FirebaseAdminHelper.instance.firestore()

		try {
			return await db.runTransaction( async transaction => {
				const handle: TransactionHandle = {
					findById: async ( id, collectionName ) => {
						const docRef = db.doc( `${ collectionName }/${ id }` )
						const docSnap = await transaction.get( docRef )
						return docSnap.exists ? docSnap.data() as DocumentObject : undefined
					},
					save: async ( id, collectionName, doc ) => {
						transaction.set( db.doc( `${ collectionName }/${ id }` ), doc as FirebaseFirestore.DocumentData )
					},
					delete: async ( id, collectionName ) => {
						transaction.delete( db.doc( `${ collectionName }/${ id }` ) )
					},
				}
				return fn( handle )
			})
		}
		catch( error ) {
			throw new TransactionConflictError()
		}
	}

	// prev should be used with next in reverse order
	// prev( limit?: number ): Promise< DocumentObject[] > {
	// }

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

	protected override async resolveCollectionPaths( template: string ): Promise<string[]> {
		const templateTokens = template.split( '/' )
		if ( templateTokens.length > 3 || templateTokens.length < 1 ) throw new Error(`FirebaseAdminDatasource.collectionsMatchingTemplate only supports collection and subcollection paths (max 3 tokens). Collection path provided: ${ template }`)
		const [ mainCollection, document, subcollection ] = templateTokens
		if ( !mainCollection || !document || !subcollection ) throw new Error('FirebaseAdminDatasource.collectionsMatchingTemplate requires a document and subcollection')
		
		if ( document[0] !== '{' ) return [ template ] // if the second token is not a document, we are in a simple collection path and we can return it as is

		const db = FirebaseAdminHelper.instance.firestore()

		const docs = await db.collection( mainCollection ).get()

		const collectionList: string[] = []
		docs.docs.forEach(( doc ) => {
			if ( subcollection ) collectionList.push( `${ mainCollection }/${ doc.id }/${ subcollection }` )
			else collectionList.push( mainCollection )
		})
		return collectionList
	}
	
	override onCollectionChange( query: QueryObject<DocumentObject>, collectionName: string, listener: CollectionChangeListener<DocumentObject> ): Unsubscriber {
		const firebaseQuery = this.queryObjectToFirebaseQuery( query, collectionName )

		return firebaseQuery.onSnapshot( snapshot => {
			const changes = snapshot.docChanges().map( change => this.toCollectionDocumentChange( change, collectionName ) )
			listener( changes, snapshot.docs.map( doc => doc.data() as DocumentObject ) )
		})
	}

	override onDocumentChange( documentPath: string, documentId: string, listener: DocumentChangeListener<DocumentObject> ): Unsubscriber {
		const db = FirebaseAdminHelper.instance.firestore()
		let previousExists: boolean | undefined

		return db.doc( `${ documentPath }/${ documentId }` ).onSnapshot( snapshot => {
			const exists = snapshot.exists

			if ( previousExists === undefined && !exists ) {
				previousExists = exists
				return
			}

			previousExists = exists
			listener({
				type: exists? 'update' : 'delete',
				before: undefined,
				after: exists? snapshot.data() as DocumentObject : undefined,
				params: { exists },
				collectionPath: documentPath,
			})
		})
	}

	private toCollectionDocumentChange( change: FirebaseFirestore.DocumentChange, collectionName: string ): DocumentChange<DocumentObject> {
		return {
			type: change.type === 'added'? 'create' : change.type === 'removed'? 'delete' : 'update',
			after: change.doc.data() as DocumentObject,
			before: undefined,
			params: {},
			collectionPath: collectionName,
		}
	}

	override onDocumentTemplateChange( collectionTemplate: string, listener: DocumentChangeListener<DocumentObject> ): Unsubscriber {
		throw new Error( 'Not implemented yet')
	}

	static toDocumentObjectChange( event: FirestoreEvent<functions.Change<DocumentSnapshot> | undefined > ): DocumentChange<DocumentObject> {
		return {
			type: event.data?.before.exists? event.data?.after.exists? 'update' : 'delete' : 'create',
			before: event.data?.before.exists? event.data.before.data() as DocumentObject : undefined,
			after: event.data?.after.exists? event.data.after.data() as DocumentObject : undefined,
			params: event.params,
			collectionPath: event.document.split('/').slice(0, -1).join('/'),
		}
	}
}