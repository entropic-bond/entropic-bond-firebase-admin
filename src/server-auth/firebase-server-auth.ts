import { ServerAuthService, UserCredentials, CustomCredentials } from 'entropic-bond'
import { UserRecord } from 'firebase-admin/lib/auth/user-record'
import { FirebaseAdminHelper } from '../firebase-admin-helper'

export class FirebaseServerAuth extends ServerAuthService {

	async getUser<T extends {}>( userId: string ): Promise<UserCredentials<T>> {
		try {
			return this.convertToUserCredentials(
				await FirebaseAdminHelper.instance.auth().getUser( userId )
			)
		} catch ( error ) {
			if ( error.code === 'auth/user-not-found' ) return undefined
			else throw new Error( error )
		}
	}

	setCustomCredentials<T extends CustomCredentials>( userId: string, customCredentials: T ): Promise<void> {
		return FirebaseAdminHelper.instance.auth().setCustomUserClaims( userId, customCredentials )
	}

	async updateUser<T extends {}>( userId: string, credentials: UserCredentials<T> ): Promise<UserCredentials<T>> {
		return this.convertToUserCredentials(
			await FirebaseAdminHelper.instance.auth().updateUser( userId, credentials )
		)
	}

	async deleteUser( userId: string ): Promise<void> {
		try {
			await FirebaseAdminHelper.instance.auth().deleteUser( userId )
		}
		catch ( error ) {
			if ( error.code === 'auth/user-not-found' ) return undefined
			else throw new Error( error )
		}
	}

	private convertToUserCredentials<T extends {}>( userData: UserRecord ): UserCredentials<T> {
		return {
			id: userData.uid,
			email: userData.email,
			emailVerified: userData.emailVerified,
			creationDate: new Date( userData.metadata.creationTime ).getTime(),
			lastLogin: new Date( userData.metadata.lastSignInTime ).getTime(),
			name: userData.displayName,
			phoneNumber: userData.phoneNumber,
			pictureUrl: userData.photoURL,
			customData: userData.customClaims as T
		}
	}
}