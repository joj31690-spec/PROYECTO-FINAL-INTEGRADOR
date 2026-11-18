#pragma once
#include <nlohmann/json.hpp>
#include <algorithm>
#include <map>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>

namespace cultura {
using json = nlohmann::json;
// Contract and rules version 1, checked against engine/sequential.mjs.
constexpr int question_count = 5, pass_correct = 3, points_per_correct = 20;
struct Unit { std::string id, exam_id; json questions, answers; };
inline std::vector<Unit> prepare(const json& input) {
    if (input.at("schemaVersion") != "1" || !input.at("exams").is_array() || !input.at("evaluations").is_array()) throw std::runtime_error("Invalid schema");
    std::map<std::string, json> exams;
    for (const auto& exam : input.at("exams")) {
        auto id = exam.at("id").get<std::string>();
        if (!exams.emplace(id, exam.at("questions")).second) throw std::runtime_error("Duplicate exam ID");
    }
    std::set<std::string> ids;
    std::vector<Unit> units;
    for (const auto& e : input.at("evaluations")) {
        auto id = e.at("evaluationId").get<std::string>();
        auto exam_id = e.at("examId").get<std::string>();
        if (id.empty() || exam_id.empty() || !ids.insert(id).second) throw std::runtime_error("Invalid evaluation ID");
        units.push_back({id, exam_id, exams.at(exam_id), e.at("answers")});
    }
    return units;
}
inline json evaluate(const Unit& unit) {
    if (!unit.questions.is_array() || unit.questions.size() != question_count || !unit.answers.is_array()) throw std::runtime_error("Invalid work unit");
    std::map<std::string, json> keys, choices;
    for (const auto& q : unit.questions) {
        auto id = q.at("id").get<std::string>();
        std::set<std::string> options;
        for (const auto& o : q.at("options")) options.insert(o.at("id").get<std::string>());
        if (id.empty() || q.at("options").size() != 4 || options.size() != 4 || options.count("") || !options.count(q.at("correctOptionId").get<std::string>()) || !keys.emplace(id, q).second) throw std::runtime_error("Invalid question");
    }
    for (const auto& a : unit.answers) {
        auto id = a.at("questionId").get<std::string>();
        if (!keys.count(id) || choices.count(id)) throw std::runtime_error("Invalid or duplicate answer");
        const auto& option = a.at("optionId");
        if (!option.is_null()) {
            bool found = false;
            for (const auto& o : keys.at(id).at("options")) if (o.at("id") == option) found = true;
            if (!option.is_string() || !found) throw std::runtime_error("Invalid option");
        }
        choices[id] = option;
    }
    int correct = 0;
    auto details = json::array();
    for (const auto& q : unit.questions) {
        auto id = q.at("id").get<std::string>();
        json selected = choices.count(id) ? choices.at(id) : json(nullptr);
        bool ok = selected == q.at("correctOptionId");
        correct += ok;
        details.push_back({{"questionId", id}, {"selectedOptionId", selected}, {"correctOptionId", q.at("correctOptionId")}, {"correct", ok}});
    }
    return {{"evaluationId", unit.id}, {"examId", unit.exam_id}, {"correct", correct}, {"total", question_count}, {"score", correct * points_per_correct}, {"passed", correct >= pass_correct}, {"details", details}};
}
inline json consolidate(std::vector<json> partials) {
    std::sort(partials.begin(), partials.end(), [](const json& a, const json& b) { return a.at("evaluationId").get<std::string>() < b.at("evaluationId").get<std::string>(); });
    long long passed = 0, correct = 0, questions = 0, score = 0;
    std::set<std::string> ids;
    for (const auto& r : partials) {
        if (!ids.insert(r.at("evaluationId").get<std::string>()).second) throw std::runtime_error("Duplicate partial result");
        passed += r.at("passed").get<bool>(); correct += r.at("correct").get<int>();
        questions += r.at("total").get<int>(); score += r.at("score").get<int>();
    }
    return {{"schemaVersion", "1"}, {"rulesVersion", "1"}, {"results", partials}, {"aggregate", {{"evaluations", partials.size()}, {"passed", passed}, {"correct", correct}, {"questions", questions}, {"totalScore", score}}}};
}
}
