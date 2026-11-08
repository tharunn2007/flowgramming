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

;(async () => {
    const results = []
    const originalSwal = window.swal
    window.swal = () => {}
    $('#modal').removeClass('fade')
    function assert(condition, message) {
        if (!condition) throw new Error(message)
    }
    async function test(name, callback) {
        try {
            await callback()
            results.push('PASS ' + name)
        } catch (error) {
            results.push('FAIL ' + name + ': ' + error.message)
        }
    }
    function reset() {
        $('#modal').modal('hide')
        currentContextName = 'main'
        graph.clear()
        start = addStartAndEndBlock('main')
        contexts = { main: { graph: graph.toJSON(), start } }
        variables = []
        updateContextsDropdown()
        clearGraphHistory()
    }
    function insert(add, link) {
        doubleClickedLink = link || findModel(start.attr('outgoing_link/next'))
        add()
    }
    function type(name) {
        return graph
            .getElements()
            .find((cell) => cell.attr('element/type') === name)
    }
    function linksAreValid() {
        graph.getLinks().forEach((link) => {
            assert(
                findModel(link.attr('element/source')),
                'missing link source'
            )
            assert(
                findModel(link.attr('element/target')),
                'missing link target'
            )
        })
    }
    function remove(element) {
        $('#modal .modal-content').attr('data-element', JSON.stringify(element))
        handleDelete()
    }
    function shortcut(key, props = {}, target = document) {
        const event = $.Event('keydown', { key, ctrlKey: true, ...props })
        $(target).trigger(event)
        return event
    }
    const additions = [
        ['input', addInput],
        ['output', addOutput],
        ['assignment', addAssignment],
        ['declaration', addDeclaration],
        ['comment', addComment],
        ['function call', addFunction],
        ['IF', addIF],
        ['while', addWhile],
        ['for', addForLoop],
        ['do-while', addDoWhileLoop],
    ]
    for (const [name, add] of additions) {
        await test(
            name + ' insertion restores all cells, links and layout',
            () => {
                reset()
                const before = readGraphState()
                insert(add)
                const after = readGraphState()
                assert(before !== after, 'insertion did not change graph')
                assert(
                    getGraphHistory().undoStack.length === 1,
                    'not one command'
                )
                undoGraph()
                assert(
                    readGraphState() === before,
                    'undo differs from original graph'
                )
                redoGraph()
                assert(
                    readGraphState() === after,
                    'redo differs from inserted graph'
                )
                linksAreValid()
            }
        )
    }
    await test('multiple insertions undo/redo in order and reuse cell IDs', () => {
        reset()
        insert(addOutput)
        const first = readGraphState()
        insert(addInput)
        const second = readGraphState()
        undoGraph()
        assert(readGraphState() === first, 'wrong first undo')
        undoGraph()
        assert(graph.getCells().length === 3, 'wrong second undo')
        redoGraph()
        assert(readGraphState() === first, 'first redo changed IDs')
        redoGraph()
        assert(readGraphState() === second, 'second redo changed IDs')
    })
    await test('legacy model endpoints can be edited and restored', () => {
        reset()
        const link = findModel(start.attr('outgoing_link/next'))
        link.set('target', type('end'))
        const before = readGraphState()
        insert(addOutput)
        undoGraph()
        assert(readGraphState() === before, 'legacy endpoint not restored')
        assert(
            typeof graph.getLinks()[0].get('target').id === 'string',
            'endpoint not normalized'
        )
    })
    await test('editing content is undoable independently from insertion', () => {
        reset()
        insert(addOutput)
        const before = readGraphState()
        handleElementDoubleClick({ model: type('output') })
        $('#exp').val('123')
        $('#okButton').click()
        const after = readGraphState()
        assert(
            type('output').attr('element/expression') === '123',
            'edit not applied'
        )
        undoGraph()
        assert(readGraphState() === before, 'edit undo failed')
        redoGraph()
        assert(readGraphState() === after, 'edit redo failed')
    })
    await test('cancelled dialogs do not edit earlier blocks or add commands', () => {
        reset()
        insert(addOutput)
        const a = type('output').id
        handleElementDoubleClick({ model: findModel(a) })
        $('#modal').modal('hide')
        assert(getGraphHistory().undoStack.length === 1, 'cancel recorded')
        insert(addOutput)
        const b = graph
            .getElements()
            .find(
                (cell) =>
                    cell.id !== a && cell.attr('element/type') === 'output'
            ).id
        handleElementDoubleClick({ model: findModel(b) })
        $('#exp').val('456')
        $('#okButton').click()
        assert(
            !findModel(a).attr('element/expression'),
            'cancelled block changed'
        )
        assert(
            findModel(b).attr('element/expression') === '456',
            'new block not edited'
        )
    })
    for (const [name, add, elementType] of [
        ['unconfigured declaration', addDeclaration, 'declare'],
        ['IF', addIF, 'if'],
        ['while', addWhile, 'while'],
    ]) {
        await test(name + ' deletion is one reversible command', () => {
            reset()
            insert(add)
            const before = readGraphState()
            remove(type(elementType))
            const after = readGraphState()
            assert(graph.getCells().length === 3, 'block not removed')
            undoGraph()
            assert(
                readGraphState() === before,
                'deleted structure not restored'
            )
            redoGraph()
            assert(readGraphState() === after, 'delete redo failed')
            linksAreValid()
        })
    }
    await test('deleting IF with a branch body restores that body on undo', () => {
        reset()
        insert(addIF)
        insert(addOutput, findModel(type('if').attr('outgoing_link/trueLink')))
        const before = readGraphState()
        remove(type('if'))
        assert(graph.getCells().length === 3, 'compound deletion incomplete')
        undoGraph()
        assert(readGraphState() === before, 'branch body lost')
        linksAreValid()
    })
    await test('deleting while with a body restores all loop links on undo', () => {
        reset()
        insert(addWhile)
        insert(
            addOutput,
            findModel(type('while').attr('outgoing_link/loopLink'))
        )
        const before = readGraphState()
        remove(type('while'))
        assert(graph.getCells().length === 3, 'loop deletion incomplete')
        undoGraph()
        assert(readGraphState() === before, 'loop body lost')
        linksAreValid()
    })
    await test('a failed compound edit rolls back without changing history', () => {
        reset()
        insert(addIF)
        const before = readGraphState(),
            count = getGraphHistory().undoStack.length
        try {
            executeGraphCommand('Fail halfway', () => {
                type('if').remove()
                throw new Error('expected failure')
            })
        } catch (error) {
            assert(error.message === 'expected failure', 'wrong error')
        }
        assert(readGraphState() === before, 'failed command changed graph')
        assert(
            getGraphHistory().undoStack.length === count,
            'failed command recorded'
        )
    })
    await test('dragging many positions produces one reversible command', () => {
        reset()
        insert(addOutput)
        const before = readGraphState(),
            output = type('output')
        paper.trigger('cell:pointerdown', { model: output })
        for (let i = 0; i < 20; i++) output.translate(1, 2)
        paper.trigger('cell:pointerup', { model: output })
        const after = readGraphState()
        assert(getGraphHistory().undoStack.length === 2, 'drag not grouped')
        undoGraph()
        assert(readGraphState() === before, 'drag undo failed')
        redoGraph()
        assert(readGraphState() === after, 'drag redo failed')
    })
    await test('restored merge-circle listeners still move branch vertices', () => {
        reset()
        insert(addIF)
        undoGraph()
        redoGraph()
        const branch = findModel(type('if').attr('outgoing_link/trueLink'))
        const circle = findModel(branch.attr('element/target'))
        const y = branch.vertices()[1].y
        circle.translate(0, 10)
        assert(branch.vertices()[1].y === y + 10, 'circle listener lost')
    })
    await test('real mouse dragging is captured through JointJS pointer events', () => {
        reset()
        insert(addOutput)
        const output = type('output'),
            before = readGraphState()
        const view = paper.findViewByModel(output)
        const body = view.el.querySelector('path, rect')
        const bounds = body.getBoundingClientRect()
        const x = bounds.left + bounds.width / 2,
            y = bounds.top + bounds.height / 2
        function mouse(target, name, dx, dy) {
            target.dispatchEvent(
                new MouseEvent(name, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: x + dx,
                    clientY: y + dy,
                    button: 0,
                    buttons: name === 'mouseup' ? 0 : 1,
                })
            )
        }
        mouse(body, 'mousedown', 0, 0)
        mouse(document, 'mousemove', 30, 40)
        mouse(document, 'mouseup', 30, 40)
        assert(readGraphState() !== before, 'mouse did not move block')
        assert(
            getGraphHistory().undoStack.length === 2,
            'mouse gesture not recorded'
        )
        undoGraph()
        assert(readGraphState() === before, 'mouse drag undo failed')
    })
    await test('new edits clear redo; pointer clicks without movement preserve it', () => {
        reset()
        insert(addOutput)
        undoGraph()
        paper.trigger('cell:pointerdown', { model: start })
        paper.trigger('cell:pointerup', { model: start })
        assert(getGraphHistory().redoStack.length === 1, 'click erased redo')
        insert(addInput)
        assert(
            getGraphHistory().redoStack.length === 0,
            'new edit retained redo'
        )
    })
    await test('history is isolated by function and survives switching and saving', () => {
        reset()
        insert(addOutput)
        const main = readGraphState()
        contexts.f = { parameters: [], returnVariable: '', returnType: '' }
        updateContextsDropdown()
        $('#currentContext').val('f')
        switchContext()
        insert(addInput)
        const fn = readGraphState()
        undoGraph()
        assert(graph.getCells().length === 3, 'function undo failed')
        $('#currentContext').val('main')
        switchContext()
        assert(readGraphState() === main, 'main changed by function undo')
        switchContext() // saveFlowChart uses this to flush the graph.
        assert(getGraphHistory().undoStack.length === 1, 'save lost history')
        undoGraph()
        assert(graph.getCells().length === 3, 'main undo unavailable')
        $('#currentContext').val('f')
        switchContext()
        redoGraph()
        assert(readGraphState() === fn, 'function redo lost after switching')
    })
    await test('opening a flowgram clears old history', () => {
        reset()
        const saved = JSON.stringify(JSON.decycle({ signingKey, contexts }))
        insert(addOutput)
        importFlowGram(saved)
        undoGraph()
        assert(graph.getCells().length === 3, 'undo restored previous document')
        assert(
            getGraphHistory().undoStack.length === 0,
            'import retained old history'
        )
    })
    await test('function-manager deletion selects main and clears invalid histories', () => {
        reset()
        contexts.f = { parameters: [], returnVariable: '', returnType: '' }
        updateContextsDropdown()
        $('#currentContext').val('f')
        switchContext()
        insert(addInput)
        updateCurrentContexts({})
        assert(currentContextName === 'main', 'deleted context still selected')
        assert(graphHistories.size <= 1, 'removed function history retained')
        assert(!contexts.f, 'function still exists')
    })
    await test('toolbar state and keyboard shortcuts follow the stacks', () => {
        reset()
        assert($('#undo-btn').prop('disabled'), 'empty undo enabled')
        insert(addOutput)
        assert(!$('#undo-btn').prop('disabled'), 'undo disabled after edit')
        shortcut('z')
        assert(graph.getCells().length === 3, 'Ctrl+Z did not undo')
        assert(!$('#redo-btn').prop('disabled'), 'redo disabled after undo')
        shortcut('z', { metaKey: true, ctrlKey: false, shiftKey: true })
        assert(type('output'), 'Cmd+Shift+Z did not redo')
        shortcut('z')
        shortcut('y')
        assert(type('output'), 'Ctrl+Y did not redo')
    })
    await test('text fields and open dialogs keep their own keyboard behavior', () => {
        reset()
        insert(addOutput)
        const before = readGraphState()
        const event = shortcut(
            'z',
            {},
            document.getElementById('message-to-send')
        )
        assert(!event.isDefaultPrevented(), 'text undo prevented')
        handleElementDoubleClick({ model: type('output') })
        shortcut('z')
        assert(readGraphState() === before, 'dialog shortcut undid graph')
        $('#modal').modal('hide')
    })
    await test('execution locks editing and does not add history commands', async () => {
        reset()
        insert(addOutput)
        type('output').attr('element/expression', '1')
        const originalSleep = sleep
        sleep = () => Promise.resolve()
        try {
            const execution = run()
            assert(historyExecutionRunning, 'history not locked')
            assert($('#undo-btn').prop('disabled'), 'undo enabled during run')
            const count = graph.getCells().length
            undoGraph()
            insert(addInput)
            assert(
                graph.getCells().length === count,
                'editing allowed during run'
            )
            await execution
            assert(!historyExecutionRunning, 'history remained locked')
            assert(
                getGraphHistory().undoStack.length === 1,
                'execution recorded'
            )
        } finally {
            sleep = originalSleep
        }
    })
    window.swal = originalSwal
    const failures = results.filter((line) => line.startsWith('FAIL')).length
    const summary =
        results.join('\n') +
        '\n\n' +
        (results.length - failures) +
        '/' +
        results.length +
        ' passed'
    const output = document.createElement('pre')
    output.id = 'history-test-results'
    output.textContent = summary
    document.body.appendChild(output)
    if (window.parent !== window) {
        window.parent.postMessage(
            { type: 'history-test-results', results: summary },
            location.origin
        )
    }
})()
