using Toybox.Application.Storage;
using Toybox.System;

class PULSOModel {
    var workoutId = "";
    var name = "";
    var exercises = [];
    var exerciseIndex = 0;
    var setIndex = 0;
    var done = 0;
    var totalSets = 0;
    var finished = false;
    var pending = [];

    function initialize() {
        var stored = Storage.getValue("pending");
        pending = stored instanceof Array ? stored : [];
    }

    function loadFromDictionary(data) {
        workoutId = text(data, "workout_id", "");
        name = text(data, "name", "Entreno");
        exercises = data["exercises"] instanceof Array ? data["exercises"] : [];
        exerciseIndex = 0;
        setIndex = 0;
        done = 0;
        finished = false;
        totalSets = 0;
        for (var i = 0; i < exercises.size(); i += 1) {
            totalSets += number(exercises[i], "sets", 3);
        }
    }

    function loadDemo() {
        workoutId = "demo";
        name = "Empuje A";
        exercises = [
            {"exercise_id" => "demo-press", "name" => "Press de banca", "sets" => 4, "reps" => 8, "weight_kg" => 80},
            {"exercise_id" => "demo-curl", "name" => "Curl de bíceps", "sets" => 3, "reps" => 12, "weight_kg" => 30}
        ];
        exerciseIndex = 0;
        setIndex = 0;
        done = 0;
        finished = false;
        totalSets = 7;
    }

    function hasWorkout() {
        return exercises.size() > 0;
    }

    function currentExercise() {
        if (exerciseIndex < 0 || exerciseIndex >= exercises.size()) {
            return null;
        }
        return exercises[exerciseIndex];
    }

    function currentSets() {
        var ex = currentExercise();
        return ex == null ? 0 : number(ex, "sets", 3);
    }

    function weight() {
        var ex = currentExercise();
        return ex == null ? 0 : number(ex, "weight_kg", 0);
    }

    function reps() {
        var ex = currentExercise();
        return ex == null ? 0 : number(ex, "reps", 0);
    }

    function exerciseCount() {
        return exercises.size();
    }

    function markSet(detectedReps, velocity, force, oneRm) {
        var ex = currentExercise();
        if (ex == null) {
            return null;
        }
        var counted = detectedReps > 0 ? detectedReps : reps();
        var record = {
            "client_set_id" => System.getTimer().toString() + "-" + exerciseIndex.toString() + "-" + setIndex.toString(),
            "workout_id" => workoutId,
            "exercise_id" => text(ex, "exercise_id", ""),
            "set_number" => setIndex + 1,
            "weight_kg" => weight(),
            "reps" => counted,
            "detected_reps" => detectedReps,
            "velocity_mps" => velocity,
            "estimated_force_n" => force,
            "estimated_1rm_kg" => oneRm
        };
        done += 1;
        setIndex += 1;
        pending.add(record);
        savePending();
        if (setIndex >= currentSets()) {
            setIndex = 0;
            exerciseIndex += 1;
            if (exerciseIndex >= exercises.size()) {
                finished = true;
            }
        }
        return record;
    }

    function goNextExercise() {
        if (exercises.size() == 0) {
            return;
        }
        exerciseIndex += 1;
        setIndex = 0;
        if (exerciseIndex >= exercises.size()) {
            exerciseIndex = exercises.size() - 1;
            setIndex = 0;
        }
    }

    function savePending() {
        Storage.setValue("pending", pending);
    }

    function removePending(clientSetId) {
        var keep = [];
        for (var i = 0; i < pending.size(); i += 1) {
            if (text(pending[i], "client_set_id", "") != clientSetId) {
                keep.add(pending[i]);
            }
        }
        pending = keep;
        savePending();
    }

    function pendingCount() {
        return pending.size();
    }

    function number(dictionary, key, fallback) {
        if (dictionary == null) {
            return fallback;
        }
        var value = dictionary[key];
        return value instanceof Number ? value : fallback;
    }

    function text(dictionary, key, fallback) {
        if (dictionary == null) {
            return fallback;
        }
        var value = dictionary[key];
        return value instanceof String ? value : fallback;
    }
}
