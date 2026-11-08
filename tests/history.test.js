/*
 # *************************************************************************************
 # Copyright (C) 2021 Ritwik Murali, Harshit Agarwal, Rajkumar S, Gali Mary Sanjana,
 # Adithi Narayan, Aishwarya B, Adithi Giridharan.
 # This file is part of Flowgramming <https://github.com/flowgrammers-org/flowgramming>.
 #
 # Flowgramming is free software: you can redistribute it and/or modify
 # it under the terms of the GNU General Public License as published by
 # the Free Software Foundation, either version 3 of the License, or
 # (at your option) any later version.
 #
 # Flowgramming is distributed in the hope that it will be useful,
 # but WITHOUT ANY WARRANTY; without even the implied warranty of
 # MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 # GNU General Public License for more details.
 #
 # You should have received a copy of the GNU General Public License
 # along with Flowgramming.  If not, see <http://www.gnu.org/licenses/>.
 # *************************************************************************************
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const scope = vm.createContext({})
vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../js/commandHistory.js'), 'utf8') +
        '\nthis.classes = { GraphCommand, CommandHistory }',
    scope
)
const { GraphCommand, CommandHistory } = scope.classes
let passed = 0
function test(name, callback) {
    callback()
    passed++
    console.log('PASS ' + name)
}
function fixture(limit) {
    let value = 'initial'
    const history = new CommandHistory(() => {}, limit)
    return {
        history,
        read: () => value,
        command: (next) =>
            new GraphCommand(
                'Edit',
                () => value,
                (saved) => {
                    value = saved
                },
                () => {
                    value = next
                }
            ),
    }
}
test('commands execute, undo and redo in stack order', () => {
    const f = fixture()
    f.history.execute(f.command('first'))
    f.history.execute(f.command('second'))
    f.history.undo()
    assert.strictEqual(f.read(), 'first')
    f.history.undo()
    assert.strictEqual(f.read(), 'initial')
    f.history.redo()
    assert.strictEqual(f.read(), 'first')
    f.history.redo()
    assert.strictEqual(f.read(), 'second')
})
test('a new edit discards the redo branch', () => {
    const f = fixture()
    f.history.execute(f.command('first'))
    f.history.undo()
    f.history.execute(f.command('replacement'))
    f.history.redo()
    assert.strictEqual(f.read(), 'replacement')
    assert.strictEqual(f.history.redoStack.length, 0)
})
test('unchanged edits preserve redo', () => {
    const f = fixture()
    f.history.execute(f.command('first'))
    f.history.undo()
    f.history.execute(f.command('initial'))
    assert.strictEqual(f.history.undoStack.length, 0)
    assert.strictEqual(f.history.redoStack.length, 1)
    f.history.redo()
    assert.strictEqual(f.read(), 'first')
})
test('partial failures roll back and preserve both stacks', () => {
    const f = fixture()
    f.history.execute(f.command('first'))
    f.history.undo()
    const command = f.command('partial')
    const mutate = command.action
    command.action = () => {
        mutate()
        throw new Error('failed edit')
    }
    assert.throws(() => f.history.execute(command), /failed edit/)
    assert.strictEqual(f.read(), 'initial')
    assert.strictEqual(f.history.undoStack.length, 0)
    assert.strictEqual(f.history.redoStack.length, 1)
})
test('redo restores the saved result without rerunning the action', () => {
    const f = fixture()
    const command = f.command('created-ID-123')
    f.history.execute(command)
    command.action = () => {
        throw new Error('must not run again')
    }
    f.history.undo()
    f.history.redo()
    assert.strictEqual(f.read(), 'created-ID-123')
})
test('bounded history discards only the oldest command', () => {
    const f = fixture(2)
    for (const value of ['one', 'two', 'three'])
        f.history.execute(f.command(value))
    assert.strictEqual(f.history.undoStack.length, 2)
    f.history.undo()
    f.history.undo()
    f.history.undo()
    assert.strictEqual(f.read(), 'one')
})
test('empty stacks are harmless', () => {
    const f = fixture()
    f.history.undo()
    f.history.redo()
    assert.strictEqual(f.read(), 'initial')
})
test('already applied movement can be recorded as one command', () => {
    const f = fixture()
    const command = f.command('moved')
    command.execute()
    f.history.record(command)
    f.history.undo()
    assert.strictEqual(f.read(), 'initial')
    f.history.redo()
    assert.strictEqual(f.read(), 'moved')
})
test('failed undo does not lose the command', () => {
    const f = fixture()
    const command = f.command('first')
    f.history.execute(command)
    command.restore = () => {
        throw new Error('restore failure')
    }
    assert.throws(() => f.history.undo(), /restore failure/)
    assert.strictEqual(f.history.undoStack.length, 1)
    assert.strictEqual(f.history.redoStack.length, 0)
})
test('independent histories cannot undo each other', () => {
    const a = fixture(),
        b = fixture()
    a.history.execute(a.command('main'))
    b.history.execute(b.command('function'))
    a.history.undo()
    assert.strictEqual(a.read(), 'initial')
    assert.strictEqual(b.read(), 'function')
})
console.log(passed + ' command history tests passed')
