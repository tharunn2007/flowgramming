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

// Each function owns its history; navigation, save, and execution are not edits.
const graphHistories = new Map()
let historyExecutionRunning = false
let pendingGraphMove = null

function getGraphHistory() {
    if (!graphHistories.has(currentContextName)) {
        graphHistories.set(
            currentContextName,
            new CommandHistory(updateHistoryControls)
        )
    }
    return graphHistories.get(currentContextName)
}

function readGraphState() {
    const state = graph.toJSON()
    // Older flowgrams can contain a full model in a link endpoint. Keep only
    // its ID so those documents can also enter history without circular data.
    state.cells.forEach((cell) => {
        ;['source', 'target'].forEach((endpoint) => {
            const value = cell[endpoint]
            if (value && value.attributes) cell[endpoint] = { id: value.id }
        })
    })
    return JSON.stringify(state)
}

function restoreGraphListeners() {
    graph.getElements().forEach((element) => {
        if (
            element.attr('element/type') === 'circle' &&
            !element.attr('element/circleType')
        ) {
            setListener(element, 'circle')
        }
    })
}

function restoreGraphState(state) {
    graph.fromJSON(JSON.parse(state))
    restoreGraphListeners()
    contexts[currentContextName].graph = graph.toJSON()
    start = findModel(contexts[currentContextName].start.id)
    paper.fitToContent({
        padding: 20,
        minWidth: paperColumn.width(),
        minHeight: paperColumn.height(),
        gridWidth: 10,
        gridHeight: 10,
    })
}

function executeGraphCommand(label, action) {
    if (historyExecutionRunning) return
    getGraphHistory().execute(
        new GraphCommand(label, readGraphState, restoreGraphState, action)
    )
}

function clearGraphHistory() {
    graphHistories.clear()
    pendingGraphMove = null
    updateHistoryControls()
}

function updateHistoryControls() {
    const history = graphHistories.get(currentContextName)
    $('#undo-btn').prop(
        'disabled',
        historyExecutionRunning || !history || !history.undoStack.length
    )
    $('#redo-btn').prop(
        'disabled',
        historyExecutionRunning || !history || !history.redoStack.length
    )
}

function undoGraph() {
    if (
        historyExecutionRunning ||
        pendingGraphMove ||
        $('#modal').hasClass('show')
    )
        return
    getGraphHistory().undo()
}

function redoGraph() {
    if (
        historyExecutionRunning ||
        pendingGraphMove ||
        $('#modal').hasClass('show')
    )
        return
    getGraphHistory().redo()
}

function setHistoryExecutionRunning(running) {
    historyExecutionRunning = running
    paper.setInteractivity(running ? false : defaultPaperInteractivity)
    $('#currentContext').prop('disabled', running)
    updateHistoryControls()
}

const defaultPaperInteractivity = paper.options.interactive

// A pointer gesture may generate hundreds of position/vertex updates. Record
// its complete before/after state once, including linked-circle adjustments.
paper.on('cell:pointerdown', () => {
    if (historyExecutionRunning) return
    pendingGraphMove = {
        context: currentContextName,
        before: readGraphState(),
    }
})
paper.on('cell:pointerup', () => {
    if (!pendingGraphMove) return
    const move = pendingGraphMove
    pendingGraphMove = null
    if (historyExecutionRunning || move.context !== currentContextName) return
    const command = new GraphCommand(
        'Move block or link',
        readGraphState,
        restoreGraphState
    )
    command.before = move.before
    command.after = readGraphState()
    getGraphHistory().record(command)
})

$('#undo-btn').on('click', undoGraph)
$('#redo-btn').on('click', redoGraph)
$(document).on('keydown.graphHistory', (event) => {
    const target = $(event.target)
    if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        target.closest('input, textarea, select, [contenteditable]').length ||
        $('#modal').hasClass('show')
    ) {
        return
    }
    const key = event.key.toLowerCase()
    if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redoGraph()
        else undoGraph()
    } else if (key === 'y') {
        event.preventDefault()
        redoGraph()
    }
})
updateHistoryControls()
