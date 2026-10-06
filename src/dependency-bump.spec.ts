/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(
	readFileSync( new URL( '../package.json', import.meta.url ), 'utf8' )
)
const lockfile = JSON.parse(
	readFileSync( new URL( '../package-lock.json', import.meta.url ), 'utf8' )
)

const baseDependencyRanges = {
	'firebase-admin': '^14.2.0',
	'firebase-functions': '7.3.2',
}

const baseDevDependencyRanges = {
	'@semantic-release/changelog': '^7.0.0',
	'@semantic-release/git': '^11.0.1',
	'@types/node': '^26.4.1',
	'semantic-release': '^25.0.9',
	'typescript': '^7.0.2',
	'vite': '^8.2.2',
	'vitest': '^5.0.0',
}

describe( 'entropic-bond dependency bump', ()=>{
	it( 'declares the entropic-bond range ^2.0.4. [REQ-1]', ()=>{
		expect( manifest.dependencies['entropic-bond'] ).toBe( '^2.0.4' )
	})

	it( 'resolves entropic-bond exactly to 2.0.4 in the lockfile. [REQ-2]', ()=>{
		expect( lockfile.packages['node_modules/entropic-bond'].version ).toBe( '2.0.4' )
	})

	it( 'keeps every other dependency range unchanged. [REQ-3]', ()=>{
		const { 'entropic-bond': _bumped, ...otherDependencies } = manifest.dependencies
		expect( otherDependencies ).toEqual( baseDependencyRanges )
		expect( manifest.devDependencies ).toEqual( baseDevDependencyRanges )
	})
})
