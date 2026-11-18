#include "scoring.hpp"
#include <fstream>
#include <iostream>
#include <sys/resource.h>
#ifdef USE_MPI
#include <mpi.h>
#else
#include <omp.h>
#endif

using namespace cultura;
void memory_record(int rank, int size) {
    rusage usage{};
    getrusage(RUSAGE_SELF, &usage);
#ifdef USE_MPI
    long local_rss = usage.ru_maxrss;
    std::vector<long> rss(size);
    MPI_Gather(&local_rss, 1, MPI_LONG, rss.data(), 1, MPI_LONG, 0, MPI_COMM_WORLD);
    // Only rank 0 writes the gathered records, preventing mixed stderr lines.
    if (rank == 0) for (int i = 0; i < size; ++i) std::cerr << "process rank=" << i << " max_rss_kib=" << rss[i] << '\n';
#else
    (void)size;
    std::cerr << "process rank=" << rank << " max_rss_kib=" << usage.ru_maxrss << '\n';
#endif
}
int main(int argc, char** argv) {
    int rank = 0, size = 1;
#ifdef USE_MPI
    MPI_Init(&argc, &argv);
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);
#endif
    try {
        if (argc != 3) throw std::runtime_error("Usage: batch seq|omp|mpi input.json (or - for stdin)");
        std::string mode = argv[1];
        json input;
        if (std::string(argv[2]) == "-") std::cin >> input;
        else { std::ifstream file(argv[2]); if (!file) throw std::runtime_error("Cannot open input"); file >> input; }
        auto units = prepare(input);
        std::vector<json> results;
#ifdef USE_MPI
        if (mode != "mpi") throw std::runtime_error("MPI binary requires mpi mode");
        // Static cyclic partition: each evaluation is processed by exactly one rank.
        for (std::size_t i = rank; i < units.size(); i += size) results.push_back(evaluate(units[i]));
        std::string encoded = json(results).dump();
        int length = static_cast<int>(encoded.size());
        std::vector<int> lengths(size), offsets(size);
        MPI_Gather(&length, 1, MPI_INT, lengths.data(), 1, MPI_INT, 0, MPI_COMM_WORLD);
        int total = 0;
        if (rank == 0) for (int i = 0; i < size; ++i) { offsets[i] = total; total += lengths[i]; }
        std::vector<char> buffer(total);
        MPI_Gatherv(encoded.data(), length, MPI_CHAR, buffer.data(), lengths.data(), offsets.data(), MPI_CHAR, 0, MPI_COMM_WORLD);
        if (rank == 0) {
            results.clear();
            for (int i = 0; i < size; ++i) {
                auto partial = json::parse(buffer.begin() + offsets[i], buffer.begin() + offsets[i] + lengths[i]);
                for (auto& result : partial) results.push_back(std::move(result));
            }
        }
#else
        (void)size;
        if (mode != "seq" && mode != "omp") throw std::runtime_error("Mode must be seq or omp");
        results.resize(units.size());
        if (mode == "seq") for (std::size_t i = 0; i < units.size(); ++i) results[i] = evaluate(units[i]);
        else {
            // Validate first: exceptions must never escape an OpenMP structured block.
            for (const auto& unit : units) (void)evaluate(unit);
            #pragma omp parallel for schedule(static)
            for (std::size_t i = 0; i < units.size(); ++i) results[i] = evaluate(units[i]);
        }
#endif
        if (rank == 0) std::cout << consolidate(std::move(results)).dump() << '\n';
        memory_record(rank, size);
#ifdef USE_MPI
        MPI_Finalize();
#endif
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "rank=" << rank << " error: " << error.what() << '\n';
#ifdef USE_MPI
        MPI_Abort(MPI_COMM_WORLD, 1);
#endif
        return 1;
    }
}
