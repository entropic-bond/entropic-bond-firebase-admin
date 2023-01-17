import { Collections, DataSource, DocumentObject, QueryObject } from 'entropic-bond'
import { FirebaseAdminHelper } from '../firebase-admin-helper'

export class FirebaseAdminDatasource extends DataSource {

	findById( id: string, collectionName: string ): Promise< DocumentObject > {
		const db = FirebaseAdminHelper.instance.firestore()
		
		return new Promise<DocumentObject>( async resolve => {
			try {
				const docSnap = db.doc( `${ collectionName }/${ id }`)
				const retrievedObj = await docSnap.get()
				resolve( retrievedObj.data() )
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
			collection.forEach( document => {
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

			resolve( doc.docs.map( doc => doc.data() ) ) 
		})
	}

	private queryObjectToFirebaseQuery( queryObject: QueryObject<DocumentObject>, collectionName: string ): FirebaseFirestore.Query<FirebaseFirestore.DocumentData> {
		const db = FirebaseAdminHelper.instance.firestore()

		let query = DataSource.toPropertyPathOperations( queryObject.operations as any ).reduce( 
			( query, operation ) =>	query.where( operation.property, operation.operator, operation.value ),
		  db.collection( collectionName ).offset( 0 )
		)

		if ( queryObject.sort ) {
			query = query.orderBy( queryObject.sort.propertyName, queryObject.sort.order ) 
		}

		if ( queryObject.limit ) {
			this._lastLimit = queryObject.limit
			query = query.limit( queryObject.limit )
		}

		return query
	}

	private _lastQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
	private _lastLimit: number
	private _lastDocRetrieved: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
}