/**
 * reads all solidity-files defined in the options
 */

import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import {
    sha3_256
} from 'js-sha3';

const globPromise = util.promisify(glob);
const readFile = util.promisify(fs.readFile);

import {
    Options
} from './options';

declare type SourceCode = {
    filename: string,
    code: string,
    codeHash: string,
    solcVersion: string
};

/**
 * https://stackoverflow.com/a/432503
 */
function matches(regex, str): { inner: string, full: string }[] {
    const ret: any = [];
    let match = regex.exec(str);
    while (match !== null) {
        ret.push({
            full: match[0],
            inner: match[1]
        });
        match = regex.exec(str);
    }
    return ret;
}

/**
 * gets the source-code from the file
 * and parses all imports
 */
export async function getSourceCode(fileName: string): Promise<string> {
    let code = await readFile(fileName, 'utf-8');
    const importsRegex = /import "([^"]*)";/g;
    const imports = matches(importsRegex, code);

    await Promise.all(
        imports.map(async (match) => {
            const p = path.resolve(fileName, '..', match.inner);
            let innerCode = await getSourceCode(p);
            // remove first line containing version
            innerCode = innerCode.replace(/^.*\n/, '');
            code = code.replace(match.full, innerCode);
        })
    );

    return code;
}

export function getSolcVersion(code: string): string {
    const regex = /^pragma solidity ([0-9\.]*);/g;
    const match = regex.exec(code);
    if (!match) throw new Error('so pragme solidity version set');
    return match[1];
}

export default async function readCodeFiles(options: Options): Promise<SourceCode[]> {
    const filePaths = await globPromise(options.sourceFolder, {});
    const ret = filePaths
        .map(p => ({
            filename: p
        }));

    await Promise.all(
        ret.map(async (file) => {
            const code = await getSourceCode(file.filename);
            file.code = code;
            file.codeHash = sha3_256(code);

            file.solcVersion = getSolcVersion(code);
        })
    );

    return ret;
}