import { Collections, DataSource, DocumentChangeListerner, DocumentChangeListernerHandler, DocumentListenerUninstaller, DocumentObject, Persistent, PersistentProperty, QueryObject, QueryOperator } from 'entropic-bond'
import { FirebaseAdminHelper } from '../firebase-admin-helper'
import { Filter, WhereFilterOp } from 'firebase-admin/firestore'
import * as functions from 'firebase-functions/v2'

export class FirebaseAdminDatasource extends DataSource {

	findById( id: string, collectionName: string ): Promise< DocumentObject > {
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

	save( collections: Collections ): Promise< void > {
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

	find( queryObject: QueryObject<DocumentObject>, collectionName: string ): Promise< DocumentObject[] > {
		const query = this.queryObjectToFirebaseQuery( queryObject, collectionName )

		this._lastQuery = query
		return this.getFromQuery( query )
	}

	async count( queryObject: QueryObject<DocumentObject>, collectionName: string ): Promise<number> {
		const query = this.queryObjectToFirebaseQuery( queryObject, collectionName )
		const snapShot = await query.count().get()

		return snapShot.data().count
	}

	delete( id: string, collectionName: string ): Promise< void > {
		const db = FirebaseAdminHelper.instance.firestore()

		return db.recursiveDelete( db.doc( `${ collectionName }/${ id }` ) )
	}

	next( maxDocs?: number ): Promise< DocumentObject[] > {
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

	protected override subscribeToDocumentChangeListerner( prop: PersistentProperty, listener: DocumentChangeListerner ): DocumentChangeListernerHandler | undefined {
		const collectionPath = Persistent.collectionPath( undefined!, prop )
		const handler = functions.firestore.onDocumentUpdated( collectionPath, event => {
			const snapshot = event.data
			listener({ 
				before: Persistent.createInstance( snapshot?.before.data() as any ).toObject(), 
				after: Persistent.createInstance( snapshot?.after.data() as any ).toObject()
			})
		})
		
		return {
			uninstall: () => {},
			nativeHandler: handler
		}
	}

	private _lastQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> | undefined
	private _lastLimit: number = 0
	private _lastDocRetrieved: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | undefined
}