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

/*
 * Command objects keep immutable graph snapshots so one undo also restores
 * the links and layout changes made by a compound editing operation.
 */
class GraphCommand {
    constructor(label, read, restore, action) {
        this.label = label
        this.read = read
        this.restore = restore
        this.action = action
        this.before = null
        this.after = null
    }

    execute() {
        if (this.after !== null) {
            this.restore(this.after)
            return true
        }
        this.before = this.read()
        try {
            this.action()
            this.after = this.read()
        } catch (error) {
            this.restore(this.before)
            throw error
        }
        // The redo branch survives cancelled, invalid, and unchanged edits.
        return this.before !== this.after
    }

    undo() {
        this.restore(this.before)
    }
}

class CommandHistory {
    constructor(onChange = () => {}, limit = 100) {
        this.undoStack = []
        this.redoStack = []
        this.onChange = onChange
        this.limit = limit
    }

    execute(command) {
        if (command.execute()) this.record(command)
    }

    record(command) {
        if (command.before === command.after) return
        this.undoStack.push(command)
        if (this.undoStack.length > this.limit) this.undoStack.shift()
        this.redoStack.length = 0
        this.onChange()
    }

    undo() {
        const command = this.undoStack[this.undoStack.length - 1]
        if (!command) return
        command.undo()
        this.undoStack.pop()
        this.redoStack.push(command)
        this.onChange()
    }

    redo() {
        const command = this.redoStack[this.redoStack.length - 1]
        if (!command) return
        command.execute()
        this.redoStack.pop()
        this.undoStack.push(command)
        this.onChange()
    }
}
