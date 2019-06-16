import * as chalk from "chalk";

describe('Chalk', () => {
    it('basic', () => {
        const source = chalk.default.cyan
        const target = chalk.default.red
        const inserted = chalk.default.green
        const changes = [
            'abcd',
            source('[') + 'ab' + target('[') + 'abcd' + target(']') + 'cd' + source(']'),
            source('[') + 'ab' + target('[') + 'ab' + inserted('x') + 'cd' + target(']') + 'cd' + source(']')
        ]
        let i = 0
        for(const change of changes) {
            console.log('rev ' + (i++) + ': ' + change)
        }
    })
})