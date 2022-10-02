import { ServerAuthService, UserCredentials, CustomCredentials } from 'entropic-bond'
import { UserRecord } from 'firebase-admin/lib/auth/user-record'
import { FirebaseAdminHelper } from '../firebase-admin-helper'

export class FirebaseServerAuth extends ServerAuthService {

	async getUser( userId: string ): Promise<UserCredentials> {
		return this.convertToUserCredentials(
			await FirebaseAdminHelper.instance.auth().getUser( userId )
		)
	}

	setCustomCredentials( userId: string, customCredentials: CustomCredentials ): Promise<void> {
		return FirebaseAdminHelper.instance.auth().setCustomUserClaims( userId, customCredentials )
	}

	async updateUser( userId: string, credentials: UserCredentials ): Promise<UserCredentials> {
		return this.convertToUserCredentials(
			await FirebaseAdminHelper.instance.auth().updateUser( userId, credentials )
		)
	}

	private convertToUserCredentials( userData: UserRecord ): UserCredentials {
		return {
			id: userData.uid,
			email: userData.email,
			emailVerified: userData.emailVerified,
			creationDate: new Date( userData.metadata.creationTime ).getTime(),
			lastLogin: new Date( userData.metadata.lastSignInTime ).getTime(),
			name: userData.displayName,
			phoneNumber: userData.phoneNumber,
			pictureUrl: userData.photoURL,
			customData: userData.customClaims
		}
	}
}